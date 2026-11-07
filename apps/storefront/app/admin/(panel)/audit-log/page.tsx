import { AuditLog } from "@/admin/components/system/audit-log";
import { screen } from "@/admin/lib/page";

const { metadata, Page } = screen("Activity log", AuditLog);
export { metadata };
export default Page;
