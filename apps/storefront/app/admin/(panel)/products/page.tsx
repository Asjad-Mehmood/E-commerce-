import { ProductsList } from "@/admin/components/products/products-list";
import { screen } from "@/admin/lib/page";

const { metadata, Page } = screen("Products", ProductsList);
export { metadata };
export default Page;
