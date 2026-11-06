import { describe, expect, it } from "vitest";
import { hasRole, isAdminRole } from "./enums";

describe("roles", () => {
  it("ranks roles so higher roles include lower ones", () => {
    expect(hasRole("SUPER_ADMIN", "MANAGER")).toBe(true);
    expect(hasRole("MANAGER", "MANAGER")).toBe(true);
    expect(hasRole("SUPPORT", "MANAGER")).toBe(false);
    expect(hasRole("CUSTOMER", "SUPPORT")).toBe(false);
  });

  it("identifies staff roles", () => {
    expect(isAdminRole("SUPPORT")).toBe(true);
    expect(isAdminRole("CUSTOMER")).toBe(false);
  });
});
