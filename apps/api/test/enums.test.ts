import { $Enums } from "@prisma/client";
import * as shared from "@hoodie/types";
import { describe, expect, it } from "vitest";

/**
 * The frontends use the enums in @hoodie/types; the database uses the Prisma
 * enums. This test fails if someone changes one without the other.
 */
const pairs = [
  ["Role", $Enums.Role, shared.Role],
  ["ProductStatus", $Enums.ProductStatus, shared.ProductStatus],
  ["Fit", $Enums.Fit, shared.Fit],
  ["OrderStatus", $Enums.OrderStatus, shared.OrderStatus],
  ["PaymentMethod", $Enums.PaymentMethod, shared.PaymentMethod],
  ["PaymentStatus", $Enums.PaymentStatus, shared.PaymentStatus],
  ["DiscountType", $Enums.DiscountType, shared.DiscountType],
  ["ReturnStatus", $Enums.ReturnStatus, shared.ReturnStatus],
  ["MessageStatus", $Enums.MessageStatus, shared.MessageStatus],
] as const;

describe("shared enums match the Prisma schema", () => {
  it.each(pairs)("%s", (_name, prismaEnum, sharedEnum) => {
    expect(Object.values(sharedEnum).sort()).toEqual(Object.values(prismaEnum).sort());
  });
});
