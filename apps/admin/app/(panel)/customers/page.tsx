import { CustomersList } from "@/components/customers/customers";
import { screen } from "@/lib/page";

const { metadata, Page } = screen("Customers", CustomersList);
export { metadata };
export default Page;
