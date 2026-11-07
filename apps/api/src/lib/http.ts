import type { ApiResponse, PaginatedResponse, PaginationMeta } from "@hoodie/types";

export const ok = <T>(data: T): ApiResponse<T> => ({ data });

export function paginated<T>(
  data: T[],
  { page, limit, total }: { page: number; limit: number; total: number },
): PaginatedResponse<T> {
  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
  return { data, meta };
}

export const skipTake = ({ page, limit }: { page: number; limit: number }) => ({
  skip: (page - 1) * limit,
  take: limit,
});
