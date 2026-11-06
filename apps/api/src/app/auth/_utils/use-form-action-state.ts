import { unstable_rethrow } from "next/navigation";
import { useActionState } from "react";

/**
 * The form gets this wrapper, never the Server Action itself, so React holds a send made before
 * hydration and makes it once hydrated. Posted natively instead, BotID couldn't vouch for it, and
 * Next 16.4 answers it on these partially prerendered pages with a blank page (vercel/next.js#99756).
 * A send that can't reach the server, or that the action throws, becomes `onRejected`'s state instead
 * of the route's error page. Next rejects with the action's `redirect()` too, so that passes on.
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
  return useActionState(
    (previous: Awaited<State>, formData: FormData) =>
      action(previous, formData).catch((error: unknown) => {
        unstable_rethrow(error);
        return onRejected(formData);
      }),
    initialState,
  );
}
