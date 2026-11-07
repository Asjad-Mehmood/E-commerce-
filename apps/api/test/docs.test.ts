import request from "supertest";
import { describe, expect, it } from "vitest";
import { routeRegistry } from "../src/lib/route";
import { app } from "./helpers";

describe("API docs", () => {
  it("serves an OpenAPI 3.1 spec that documents every registered route", async () => {
    const res = await request(app).get("/api/docs/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");

    for (const r of routeRegistry.filter((r) => !r.fullPath.includes("__test"))) {
      const path = r.fullPath.replace(/:(\w+)/g, "{$1}");
      expect(res.body.paths[path]?.[r.method], `${r.method.toUpperCase()} ${path}`).toBeDefined();
    }
  });

  it("documents request bodies, query parameters and access rules", async () => {
    const { body } = await request(app).get("/api/docs/openapi.json");
    const login = body.paths["/api/v1/auth/login"].post;
    expect(login.requestBody.content["application/json"].schema.properties).toHaveProperty(
      "password",
    );
    expect(login.responses).toHaveProperty("429");

    const list = body.paths["/api/v1/products"].get;
    expect(list.parameters.map((p: { name: string }) => p.name)).toEqual(
      expect.arrayContaining(["category", "size", "sort", "page"]),
    );

    const admin = body.paths["/api/v1/admin/products"].get;
    expect(admin.description).toContain("MANAGER");
    expect(admin.security).toBeDefined();
  });

  it("serves the Swagger UI", async () => {
    const res = await request(app).get("/api/docs/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });
});
