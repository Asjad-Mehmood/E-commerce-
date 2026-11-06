import { describe, expect, it } from "vitest";
import { adminNav, canAccess, navForRole } from "./nav";

const labels = (role: Parameters<typeof navForRole>[0]) =>
  navForRole(role).flatMap((s) => s.items.map((i) => i.label));

describe("admin navigation RBAC", () => {
  it("ranks roles", () => {
    expect(canAccess("SUPER_ADMIN", "MANAGER")).toBe(true);
    expect(canAccess("SUPPORT", "MANAGER")).toBe(false);
    expect(canAccess("CUSTOMER", "SUPPORT")).toBe(false);
  });

  it("gives Super Admins every module", () => {
    const all = adminNav.flatMap((s) => s.items).length;
    expect(labels("SUPER_ADMIN")).toHaveLength(all);
  });

  it("limits Support staff to orders, customers and messages", () => {
    const support = labels("SUPPORT");
    expect(support).toEqual(
      expect.arrayContaining(["Dashboard", "Orders", "Customers", "Messages"]),
    );
    expect(support).not.toContain("Products");
    expect(support).not.toContain("Staff");
  });

  it("hides staff and store settings from Managers", () => {
    const manager = labels("MANAGER");
    expect(manager).toContain("Products");
    expect(manager).not.toContain("Staff");
    expect(manager).not.toContain("Audit log");
  });

  it("shows customers nothing", () => {
    expect(navForRole("CUSTOMER")).toEqual([]);
  });
});
