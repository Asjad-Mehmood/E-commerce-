import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("lets later custom theme colours override earlier ones", () => {
    expect(cn("text-white", "text-ink")).toBe("text-ink");
    expect(cn("bg-ink", "bg-brand-600")).toBe("bg-brand-600");
    expect(cn("border-line", "border-danger")).toBe("border-danger");
  });

  it("keeps non-conflicting utilities (font size vs colour)", () => {
    expect(cn("text-sm", "text-muted")).toBe("text-sm text-muted");
  });

  it("drops falsy values", () => {
    const hidden = false;
    expect(cn("p-2", hidden && "hidden", undefined, "m-1")).toBe("p-2 m-1");
  });
});
