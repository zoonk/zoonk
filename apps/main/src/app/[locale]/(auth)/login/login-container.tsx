"use client";

import { FullPageLoading } from "@zoonk/ui/components/loading";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/client";

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

  return <div className="flex flex-col gap-6">{children}</div>;
}
