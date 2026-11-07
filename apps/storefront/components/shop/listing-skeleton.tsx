import { Container, Skeleton } from "@hoodie/ui";

export function ListingSkeleton() {
  return (
    <Container className="py-12" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-64" />
      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[4/5] rounded-xl" />
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/3" />
          </div>
        ))}
      </div>
    </Container>
  );
}
