import { useLogout } from "@zoonk/auth/hooks/logout";
import { useCallback } from "react";
import { useRouter } from "@/i18n/navigation";

export function usei18nLogout() {
  const { push } = useRouter();

  const onSuccess = useCallback(() => {
    push("/login");
  }, [push]);

  return useLogout({ onSuccess });
}
