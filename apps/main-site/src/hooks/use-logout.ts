import { useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function useLogout() {
  const { data: session } = authClient.useSession();
  const { push } = useRouter();

  const isLoggedIn = Boolean(session);

  const logout = useCallback(async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          push("/login");
        },
      },
    });
  }, [push]);

  return { isLoggedIn, logout };
}
