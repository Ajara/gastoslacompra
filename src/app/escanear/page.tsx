import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ScanFlow } from "@/components/scan-flow";
import { getMembership } from "@/lib/household";

export default async function EscanearPage() {
  const { user, household } = await getMembership();
  if (!user) redirect("/login");
  if (!household) redirect("/hucha");

  return (
    <AppShell inviteCode={household.invite_code}>
      <ScanFlow householdId={household.id} />
    </AppShell>
  );
}
