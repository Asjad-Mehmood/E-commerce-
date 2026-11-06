import { NewProduct } from "@/components/products/product-form";
import { screen } from "@/lib/page";

const { metadata, Page } = screen("Add product", NewProduct);
export { metadata };
export default Page;
