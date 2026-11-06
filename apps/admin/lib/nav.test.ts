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
    expect(manager).not.toContain("Activity log");
  });

  it("shows customers nothing", () => {
    expect(navForRole("CUSTOMER")).toEqual([]);
  });
});

describe("active nav item", () => {
  it("prefers the most specific match", async () => {
    const { activeItem, minRoleFor } = await import("./nav");
    expect(activeItem("/settings/shipping")?.label).toBe("Shipping");
    expect(activeItem("/settings")?.label).toBe("Store settings");
    expect(activeItem("/orders/HD-10001")?.label).toBe("Orders");
    expect(activeItem("/")?.label).toBe("Dashboard");
    expect(activeItem("/ordersx")).toBeUndefined();
    expect(minRoleFor("/staff")).toBe("SUPER_ADMIN");
    expect(minRoleFor("/products/abc")).toBe("MANAGER");
    expect(minRoleFor("/orders")).toBe("SUPPORT");
  });
});
