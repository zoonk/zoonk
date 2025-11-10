import { redirect, unauthorized } from "next/navigation";
import { getSession } from "@/lib/user";

export default async function PrivateLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const isAdmin = session.user.role === "admin";

  if (!isAdmin) {
    unauthorized();
  }

  return <>{children}</>;
}
