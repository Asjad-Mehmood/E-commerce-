import { ListingSkeleton } from "@/components/shop/listing-skeleton";

// Only on routes that can never 404: a loading boundary starts streaming with
// status 200, which would turn a missing page's 404 into a 200.
export default function Loading() {
  return <ListingSkeleton />;
}
