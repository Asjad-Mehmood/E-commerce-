import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type TestAgent from "supertest/lib/agent";
import { env } from "../src/config/env";
import { signCloudinaryParams } from "../src/modules/admin/uploads.routes";
import { app, signedInAgent } from "./helpers";

let admin: TestAgent;
beforeAll(async () => {
  admin = (await signedInAgent("MANAGER")).agent;
});

const name = (prefix: string) => `${prefix} ${randomUUID().slice(0, 6)}`;

describe("admin categories", () => {
  it("creates nested categories that appear in the public tree", async () => {
    const parent = await admin.post("/api/v1/admin/categories").send({ name: name("Kids") });
    expect(parent.status).toBe(201);
    const child = await admin
      .post("/api/v1/admin/categories")
      .send({ name: name("Kids Zip"), parentId: parent.body.data.id });

    const tree = await request(app).get("/api/v1/categories");
    const node = tree.body.data.find((c: { id: string }) => c.id === parent.body.data.id);
    expect(node.children).toEqual([expect.objectContaining({ id: child.body.data.id })]);
  });

  it("prevents loops in the category tree", async () => {
    const a = await admin.post("/api/v1/admin/categories").send({ name: name("A") });
    const b = await admin
      .post("/api/v1/admin/categories")
      .send({ name: name("B"), parentId: a.body.data.id });

    expect(
      (
        await admin
          .patch(`/api/v1/admin/categories/${a.body.data.id}`)
          .send({ parentId: a.body.data.id })
      ).status,
    ).toBe(400);
    const loop = await admin
      .patch(`/api/v1/admin/categories/${a.body.data.id}`)
      .send({ parentId: b.body.data.id });
    expect(loop.status).toBe(400);
    expect(loop.body.error.message).toMatch(/own sub-categories/);
  });

  it("moves children to the top level when a parent is deleted", async () => {
    const parent = await admin.post("/api/v1/admin/categories").send({ name: name("Old") });
    const child = await admin
      .post("/api/v1/admin/categories")
      .send({ name: name("Child"), parentId: parent.body.data.id });

    expect((await admin.delete(`/api/v1/admin/categories/${parent.body.data.id}`)).status).toBe(
      204,
    );
    const list = await admin.get("/api/v1/admin/categories");
    expect(
      list.body.data.find((c: { id: string }) => c.id === child.body.data.id).parentId,
    ).toBeNull();
  });

  it("rejects duplicate slugs", async () => {
    expect(
      (
        await admin
          .post("/api/v1/admin/categories")
          .send({ name: "Pullover again", slug: "pullover" })
      ).status,
    ).toBe(409);
  });
});

describe("admin collections", () => {
  it("creates, updates without resetting other fields, and deletes", async () => {
    const created = await admin
      .post("/api/v1/admin/collections")
      .send({ name: name("Eid Drop"), isFeatured: true, position: 3 });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const updated = await admin
      .patch(`/api/v1/admin/collections/${id}`)
      .send({ description: "Limited run" });
    expect(updated.body.data).toMatchObject({
      description: "Limited run",
      isFeatured: true,
      position: 3,
    });

    expect((await admin.delete(`/api/v1/admin/collections/${id}`)).status).toBe(204);
    expect((await admin.delete(`/api/v1/admin/collections/${id}`)).status).toBe(404);
  });
});

describe("upload signing", () => {
  it("matches Cloudinary's documented signature example", () => {
    // https://cloudinary.com/documentation/authentication_signatures
    const signature = signCloudinaryParams(
      {
        eager: "w_400,h_300,c_pad|w_260,h_200,c_crop",
        public_id: "sample_image",
        timestamp: 1315060510,
      },
      "abcd",
    );
    expect(signature).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });

  it("returns 503 when Cloudinary is not configured", async () => {
    const res = await admin.post("/api/v1/admin/uploads/sign").send({ folder: "products" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("returns signed upload parameters when configured", async () => {
    Object.assign(env, {
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "key123",
      CLOUDINARY_API_SECRET: "shh",
    });
    try {
      const res = await admin.post("/api/v1/admin/uploads/sign").send({ folder: "products" });
      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d).toMatchObject({
        apiKey: "key123",
        folder: "hoodie/products",
        uploadUrl: "https://api.cloudinary.com/v1_1/demo/image/upload",
      });
      expect(d.signature).toBe(
        signCloudinaryParams({ folder: d.folder, timestamp: d.timestamp }, "shh"),
      );
      expect(JSON.stringify(d)).not.toContain("shh");
    } finally {
      Object.assign(env, {
        CLOUDINARY_CLOUD_NAME: undefined,
        CLOUDINARY_API_KEY: undefined,
        CLOUDINARY_API_SECRET: undefined,
      });
    }
  });

  it("rejects unknown folders", async () => {
    expect((await admin.post("/api/v1/admin/uploads/sign").send({ folder: "../etc" })).status).toBe(
      422,
    );
  });
});
