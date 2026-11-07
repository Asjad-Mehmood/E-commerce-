import request from "supertest";
import { describe, expect, it } from "vitest";
import { app, cookieValue, createUser, PASSWORD, signedInAgent } from "./helpers";

const address = {
  fullName: "Ali Khan",
  phone: "03001234567",
  line1: "House 12, Street 4",
  city: "Lahore",
  postalCode: "54000",
};

describe("profile", () => {
  it("updates name and phone", async () => {
    const { agent } = await signedInAgent();
    const res = await agent.patch("/api/v1/me").send({ name: "New Name", phone: "+923001112233" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "New Name", phone: "+923001112233" });
  });

  it("cannot change role or email through the profile endpoint", async () => {
    const { agent, user } = await signedInAgent();
    const res = await agent.patch("/api/v1/me").send({ role: "SUPER_ADMIN", email: "x@y.z" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ role: "CUSTOMER", email: user.email });
  });
});

describe("change password", () => {
  it("requires the current password", async () => {
    const { agent } = await signedInAgent();
    const res = await agent
      .patch("/api/v1/auth/password")
      .send({ currentPassword: "Wrong1234", newPassword: "Better123" });
    expect(res.status).toBe(422);
    expect(res.body.error.details.fieldErrors.currentPassword).toBeDefined();
  });

  it("changes it and signs out other devices but keeps this one", async () => {
    const user = await createUser();
    const phone = request.agent(app);
    const laptop = request.agent(app);
    await phone.post("/api/v1/auth/login").send({ email: user.email, password: PASSWORD });
    await laptop.post("/api/v1/auth/login").send({ email: user.email, password: PASSWORD });

    const res = await laptop
      .patch("/api/v1/auth/password")
      .send({ currentPassword: PASSWORD, newPassword: "Better123" });
    expect(res.status).toBe(204);

    expect((await laptop.post("/api/v1/auth/refresh")).status).toBe(200);
    expect((await phone.post("/api/v1/auth/refresh")).status).toBe(401);
  });
});

describe("addresses", () => {
  it("makes the first address the default and keeps exactly one default", async () => {
    const { agent } = await signedInAgent();
    const first = await agent.post("/api/v1/me/addresses").send(address);
    expect(first.status).toBe(201);
    expect(first.body.data.isDefault).toBe(true);
    expect(first.body.data.country).toBe("PK");

    const second = await agent
      .post("/api/v1/me/addresses")
      .send({ ...address, city: "Karachi", isDefault: true });
    expect(second.body.data.isDefault).toBe(true);

    const list = await agent.get("/api/v1/me/addresses");
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data.filter((a: { isDefault: boolean }) => a.isDefault)).toHaveLength(1);
    expect(list.body.data[0].city).toBe("Karachi"); // default first
  });

  it("promotes another address when the default is deleted", async () => {
    const { agent } = await signedInAgent();
    const a = await agent.post("/api/v1/me/addresses").send(address);
    await agent.post("/api/v1/me/addresses").send({ ...address, city: "Multan" });

    expect((await agent.delete(`/api/v1/me/addresses/${a.body.data.id}`)).status).toBe(204);
    const list = await agent.get("/api/v1/me/addresses");
    expect(list.body.data).toEqual([expect.objectContaining({ city: "Multan", isDefault: true })]);
  });

  it("cannot read or change another user's address", async () => {
    const { agent: owner } = await signedInAgent();
    const { agent: other } = await signedInAgent();
    const a = await owner.post("/api/v1/me/addresses").send(address);

    expect((await other.put(`/api/v1/me/addresses/${a.body.data.id}`).send(address)).status).toBe(
      404,
    );
    expect((await other.delete(`/api/v1/me/addresses/${a.body.data.id}`)).status).toBe(404);
  });
});

describe("cookies", () => {
  it("are not marked Secure outside production (so localhost works)", async () => {
    const user = await createUser();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: PASSWORD });
    expect(cookieValue(res, "access_token")).toBeTruthy();
    expect((res.headers["set-cookie"] as unknown as string[]).join(";")).not.toMatch(/Secure/);
  });
});
