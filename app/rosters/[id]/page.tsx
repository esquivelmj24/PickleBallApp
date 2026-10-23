import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RosterDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  return <Dashboard alias={user.alias} role={user.role} rosterId={id} />;
}
