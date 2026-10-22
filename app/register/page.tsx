import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/");
  return <AuthCard mode="register" />;
}
