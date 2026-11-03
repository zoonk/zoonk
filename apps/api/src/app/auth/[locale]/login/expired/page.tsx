import { LoginScreen } from "../login-screen";

export default function ExpiredLoginPage({
  searchParams,
}: PageProps<"/auth/[locale]/login/expired">) {
  return <LoginScreen expired searchParams={searchParams} />;
}
