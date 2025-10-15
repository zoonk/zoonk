import { useCallback } from "react";
import { zoonkAuthClient } from "../client";

type UseLogoutArgs = {
  onError?: () => void;
  onSuccess: () => void;
};

export function useLogout({ onSuccess, onError }: UseLogoutArgs) {
  const { data: session } = zoonkAuthClient.useSession();

  const isLoggedIn = Boolean(session);

  const logout = useCallback(async () => {
    await zoonkAuthClient.signOut({
      fetchOptions: { onError, onSuccess },
    });
  }, [onError, onSuccess]);

  return { isLoggedIn, logout };
}
