import { requirePermission } from "@/server/auth/guards";
import { listReports } from "@/server/services/report.service";
import { ModerationView } from "./moderation-view";

export const metadata = { title: "Denúncias" };

export default async function ModerationPage() {
  await requirePermission("moderation.manage");
  const reports = await listReports();
  return <ModerationView reports={JSON.parse(JSON.stringify(reports))} />;
}
