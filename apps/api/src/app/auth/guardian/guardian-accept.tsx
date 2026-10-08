"use client";

import { SetupError, SetupSubmit } from "@/components/setup";
import { useExtracted } from "next-intl";
import { useActionState } from "react";
import { type AcceptInviteState, acceptInviteAction } from "./actions";

function AcceptError({ status }: { status: AcceptInviteState["status"] }) {
  const t = useExtracted();

  switch (status) {
    case "emailNotVerified":
      return t("Confirm your email address first, then open the invite again.");
    case "wrongAccount":
      return t("This invite was sent to another email. Sign in with that email to accept it.");
    case "expired":
      return t("This invite expired. Ask for a new one.");
    case "unauthorized":
      return t("Sign in with the email this invite was sent to.");
    case "idle":
    case "notFound":
      return t("We couldn't find this invite. It may have been canceled.");
    default:
      return t("We couldn't find this invite. It may have been canceled.");
  }
}

/** Accepting is a deliberate tap, so opening the link (or a mail scanner) never accepts it. */
export function GuardianAcceptForm({ token }: { token: string }) {
  const t = useExtracted();

  const [state, formAction] = useActionState<AcceptInviteState>(
    acceptInviteAction.bind(null, token),
    { status: "idle" },
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <SetupError hasError={state.status !== "idle"}>
        <AcceptError status={state.status} />
      </SetupError>
      <SetupSubmit>{t("Accept invite")}</SetupSubmit>
    </form>
  );
}
