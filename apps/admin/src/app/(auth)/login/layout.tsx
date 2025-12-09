import { getSession } from "@zoonk/core/users";
import { Container } from "@zoonk/ui/components/container";
import { redirect } from "next/navigation";

export default async function AuthLayout({ children }: LayoutProps<"/login">) {
  const session = await getSession();

  if (session) {
    redirect("/");
  }

  return <Container variant="centered">{children}</Container>;
}
