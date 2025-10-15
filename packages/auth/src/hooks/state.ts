import { zoonkAuthClient } from "../client";

export function useAuthState() {
  const { data, isPending } = zoonkAuthClient.useSession();

  if (isPending) {
    return "pending";
  }

  return data ? "authenticated" : "unauthenticated";
}
