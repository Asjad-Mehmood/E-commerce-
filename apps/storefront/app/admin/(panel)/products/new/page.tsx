import { NewProduct } from "@/admin/components/products/product-form";
import { screen } from "@/admin/lib/page";

const { metadata, Page } = screen("Add product", NewProduct);
export { metadata };
export default Page;
