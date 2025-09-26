import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/user";
import LoginPage from "./LoginPage";

export default async function Login({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;

  const session = await getSession();

  if (session) {
    return redirect({ href: "/", locale });
  }

  return <LoginPage params={params} />;
}
