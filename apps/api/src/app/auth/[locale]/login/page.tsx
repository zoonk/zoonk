import { LoginScreen } from "./login-screen";

export default function LoginPage({ searchParams }: PageProps<"/auth/[locale]/login">) {
  return <LoginScreen expired={false} searchParams={searchParams} />;
}
