import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { unstable_rethrow } from "next/navigation";
import { useActionState } from "react";

/**
 * Until hydration the form gets the Server Action itself, so a send before the scripts load posts
 * natively. After it, a send that can't reach the server, or that the action throws, becomes
 * `onRejected`'s state instead of the route's error page. Next rejects with the action's `redirect()`
 * too, so that passes on.
 */
export function useFormActionState<State>({
  action,
  initialState,
  onRejected,
}: {
  action: (state: Awaited<State>, formData: FormData) => Promise<State>;
  initialState: Awaited<State>;
  onRejected: (formData: FormData) => State;
}) {
  const isHydrated = useIsMounted();

  return useActionState(
    // oxlint-disable-next-line zoonk/no-uncaught-transition-await -- Before hydration the form posts natively, which needs the Server Action itself.
    isHydrated
      ? (previous: Awaited<State>, formData: FormData) =>
          action(previous, formData).catch((error: unknown) => {
            unstable_rethrow(error);
            return onRejected(formData);
          })
      : action,
    initialState,
  );
}
