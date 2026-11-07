import { CustomersList } from "@/admin/components/customers/customers";
import { screen } from "@/admin/lib/page";

const { metadata, Page } = screen("Customers", CustomersList);
export { metadata };
export default Page;
