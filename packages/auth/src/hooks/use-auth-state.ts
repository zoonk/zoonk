import { authClient } from "../client";

export function useAuthState() {
  const { data, isPending } = authClient.useSession();

  if (isPending) {
    return "pending";
  }

  return data ? "authenticated" : "unauthenticated";
}
