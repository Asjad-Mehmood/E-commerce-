import { AuditLog } from "@/components/system/audit-log";
import { screen } from "@/lib/page";

const { metadata, Page } = screen("Activity log", AuditLog);
export { metadata };
export default Page;
