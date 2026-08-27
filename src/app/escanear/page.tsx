import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ScanFlow } from "@/components/scan-flow";
import { getMe } from "@/lib/api";

export default async function EscanearPage() {
  const { user, household } = await getMe();
  if (!user) redirect("/login");
  if (!household) redirect("/hucha");

  return (
    <AppShell inviteCode={household.invite_code}>
      <ScanFlow />
    </AppShell>
  );
}
