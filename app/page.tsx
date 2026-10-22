import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <Dashboard alias={user.alias} />;
}
