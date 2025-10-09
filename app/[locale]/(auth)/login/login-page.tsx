import { unstable_cacheLife as cacheLife } from "next/cache";
import { setRequestLocale } from "next-intl/server";
import LoginFooter from "./login-footer";
import LoginForm from "./login-form";
import LoginHeader from "./login-header";

interface LoginPageProps {
  params: PageProps<"/[locale]/login">["params"];
}

export default async function LoginPage({ params }: LoginPageProps) {
  "use cache";
  cacheLife("max");

  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex flex-col gap-6">
      <LoginHeader />
      <LoginForm />
      <LoginFooter />
    </div>
  );
}
