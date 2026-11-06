import { unstable_rethrow } from "next/navigation";
import { useActionState } from "react";

export type AdminActionState = { error: string | null; submissionId: number };

/**
 * A save that can't reach the server, or that the action throws (`assertAdmin()` does once the
 * session expires), becomes the form's own error instead of the route's error page. React resets the
 * form after the action, so `onRejected` returns what the failed state keeps, such as what was typed.
 * Next rejects with the action's `redirect()` too, so that passes on.
 */
export function useAdminActionState<State extends AdminActionState>({
  action,
  initialState,
  onRejected = (previous) => previous,
}: {
  action: (state: Awaited<State>, formData: FormData) => Promise<Awaited<State>>;
  initialState: Awaited<State>;
  onRejected?: (state: Awaited<State>, formData: FormData) => Awaited<State>;
}) {
  return useActionState(
    (previous: Awaited<State>, formData: FormData) =>
      action(previous, formData).catch((error: unknown): Awaited<State> => {
        unstable_rethrow(error);

        return {
          ...onRejected(previous, formData),
          error: "Something went wrong. Try again, or reload the page if it keeps happening.",
          submissionId: previous.submissionId + 1,
        };
      }),
    initialState,
  );
}

/** For a Server Action that returns nothing and throws when it fails. */
export function useAdminFormAction(action: (formData: FormData) => Promise<void>) {
  return useAdminActionState({
    action: async (previous: AdminActionState, formData: FormData) => {
      await action(formData);
      return { error: null, submissionId: previous.submissionId + 1 };
    },
    initialState: { error: null, submissionId: 0 },
  });
}
