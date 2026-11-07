import { EmailSettings } from "@/admin/components/system/email-settings";
import { screen } from "@/admin/lib/page";

const { metadata, Page } = screen("Email settings", EmailSettings);
export { metadata };
export default Page;
