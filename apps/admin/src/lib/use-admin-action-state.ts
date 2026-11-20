import { showErrorToast } from "@zoonk/ui/components/toast";
import { unstable_rethrow } from "next/navigation";
import { useActionState } from "react";

export type AdminActionState = { error: string | null; submissionId: number };

/**
 * A save that can't reach the server, or that the action throws (`assertAdmin()` does once the
 * session expires), becomes the form's own error instead of the route's error page. React resets the
 * form after the action, so `onRejected` returns what the failed state keeps, such as what was typed.
 * Next rejects with the action's `redirect()` too, so that passes on.
 *
 * A failure is said in a toast, so nothing on the page moves to make room for it. A form that
 * keeps room for it beside its own button asks for `"inline"`; a dialog does, since a toast sits
 * under a dialog's backdrop.
 */
export function useAdminActionState<State extends AdminActionState>({
  action,
  initialState,
  onRejected = (previous) => previous,
  report = "toast",
}: {
  action: (state: Awaited<State>, formData: FormData) => Promise<Awaited<State>>;
  initialState: Awaited<State>;
  onRejected?: (state: Awaited<State>, formData: FormData) => Awaited<State>;
  report?: "inline" | "toast";
}) {
  return useActionState(async (previous: Awaited<State>, formData: FormData) => {
    const next = await action(previous, formData).catch((error: unknown): Awaited<State> => {
      unstable_rethrow(error);

      return {
        ...onRejected(previous, formData),
        error: "Something went wrong. Try again or reload the page.",
        submissionId: previous.submissionId + 1,
      };
    });

    if (next.error && report === "toast") {
      showErrorToast(next.error);
    }

    return next;
  }, initialState);
}
