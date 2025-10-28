import { cacheLife, cacheTag } from "next/cache";
import { setRequestLocale } from "next-intl/server";
import LoginFooter from "./login-footer";
import LoginForm from "./login-form";
import LoginHeader from "./login-header";

type LoginPageProps = {
  params: PageProps<"/[locale]/login">["params"];
};

export default async function LoginPage({ params }: LoginPageProps) {
  "use cache";

  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, "login");

  return (
    <div className="flex flex-col gap-6">
      <LoginHeader />
      <LoginForm />
      <LoginFooter />
    </div>
  );
}
