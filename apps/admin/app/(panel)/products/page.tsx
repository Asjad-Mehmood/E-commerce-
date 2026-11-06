import { ProductsList } from "@/components/products/products-list";
import { screen } from "@/lib/page";

const { metadata, Page } = screen("Products", ProductsList);
export { metadata };
export default Page;
