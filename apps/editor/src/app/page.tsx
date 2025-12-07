import { getSession } from "@zoonk/core/users";
import { redirect, unauthorized } from "next/navigation";
import { EditorHeader } from "@/components/header";

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // temporarily restrict access to app admins only
  // in the future, we will allow any logged-in user to access the editor
  const isAdmin = session.user.role === "admin";

  if (!isAdmin) {
    unauthorized();
  }

  return (
    <>
      <EditorHeader active="home" />
      {}
    </>
  );
}
