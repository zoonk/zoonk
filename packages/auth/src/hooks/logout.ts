import { authClient } from "../client";

type UseLogoutArgs = {
  onError?: () => void;
  onSuccess?: () => void;
};

export function useLogout({ onSuccess, onError }: UseLogoutArgs = {}) {
  const { data: session } = authClient.useSession();

  const isLoggedIn = Boolean(session);

  const logout = async () => {
    await authClient.signOut({
      fetchOptions: { onError, onSuccess },
    });
  };

  return { isLoggedIn, logout };
}
