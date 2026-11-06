import { registerSchema } from "@hoodie/validation";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { validate } from "../src/middleware/validate";
import { AppError } from "../src/utils/app-error";

const app = createApp({
  extend: (router) => {
    router.post("/__test/register", validate({ body: registerSchema }), (req, res) => {
      res.status(201).json({ data: req.body });
    });
    router.get("/__test/missing", () => {
      throw AppError.notFound("Hoodie");
    });
    router.get("/__test/async-boom", async () => {
      await Promise.resolve();
      throw new Error("database exploded");
    });
  },
});

describe("error handling", () => {
  it("returns 404 in the standard envelope for unknown routes", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: "NOT_FOUND" });
    expect(res.body.error.requestId).toBeTruthy();
  });

  it("maps AppError to its status and code", async () => {
    const res = await request(app).get("/api/v1/__test/missing");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: "NOT_FOUND", message: "Hoodie not found" });
  });

  it("returns 422 with field errors when validation fails", async () => {
    const res = await request(app)
      .post("/api/v1/__test/register")
      .send({ name: "A", email: "not-an-email", password: "weak" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.error.details.fieldErrors)).toEqual(
      expect.arrayContaining(["name", "email", "password"]),
    );
  });

  it("passes parsed (normalised) bodies to the handler", async () => {
    const res = await request(app)
      .post("/api/v1/__test/register")
      .send({ name: "Ali Khan", email: "ALI@Example.com", password: "Hoodie123" });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe("ali@example.com");
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/v1/__test/register")
      .set("Content-Type", "application/json")
      .send('{"name": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("catches async errors and returns 500 without crashing", async () => {
    const res = await request(app).get("/api/v1/__test/async-boom");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(res.body.error.message).toBe("Something went wrong");
  });
});
