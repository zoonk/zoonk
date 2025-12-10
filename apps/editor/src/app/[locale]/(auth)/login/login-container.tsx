"use client";

import { authClient } from "@zoonk/auth/client";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { Login } from "@zoonk/ui/patterns/auth/login";
import { useRouter } from "next/navigation";

export default function LoginContainer({ children }: React.PropsWithChildren) {
  const { push } = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <FullPageLoading />;
  }

  if (session) {
    push("/");
    return null;
  }

  return <Login>{children}</Login>;
}
