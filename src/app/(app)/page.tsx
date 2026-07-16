import { DashboardView } from "@/components/dashboard/DashboardView";
import { getFinanceDashboard } from "@/lib/googleSheets";

export default async function DashboardPage() {
  const data = await getFinanceDashboard();

  return <DashboardView data={data} />;
}
