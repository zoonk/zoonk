"use client";

import { Button } from "@zoonk/ui/components/button";
import { Field, FieldLabel } from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import {
  CheckIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  EyeIcon,
  PencilOffIcon,
  ShieldAlertIcon,
  XIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import {
  type CliLoginDecision,
  type CliLoginFailure,
  type CliLoginState,
  decideCliLogin,
} from "./decide-cli-login";

const LOGIN_COMMAND = "pnpm zoonk login";

function CodeReadout({ userCode }: { userCode: string }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-mono text-3xl font-medium tracking-wider">{userCode}</p>
      <p className="text-muted-foreground text-sm">
        {t("Check that it matches the code in your terminal.")}
      </p>
      <input name="userCode" type="hidden" value={userCode} />
    </div>
  );
}

function CodeField() {
  const t = useExtracted();
  const id = useId();

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("Code from your terminal")}</FieldLabel>
      <Input
        autoCapitalize="characters"
        autoComplete="off"
        className="font-mono"
        id={id}
        name="userCode"
        required
        spellCheck={false}
      />
    </Field>
  );
}

function Grant({ email }: { email: string }) {
  const t = useExtracted();
  const id = useId();

  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 className="text-sm font-medium" id={id}>
        {t("If you approve")}
      </h2>

      <ul className="flex flex-col gap-3 text-sm">
        <li className="flex gap-3">
          <EyeIcon aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          {t("The CLI reads production data as {email}, such as accounts, plans and answers.", {
            email,
          })}
        </li>
        <li className="flex gap-3">
          <PencilOffIcon
            aria-hidden="true"
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
          />
          {t("It can't change anything.")}
        </li>
        <li className="flex gap-3">
          <ClockIcon aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          {t(
            "It stays logged in on that computer until you log out there or leave it unused for 30 days.",
          )}
        </li>
      </ul>
    </section>
  );
}

function DecisionButtons({ enterApproves }: { enterApproves: boolean }) {
  const t = useExtracted();
  const { data, pending } = useFormStatus();
  const deciding = pending ? data?.get("decision") : null;
  const approveRef = useEnterClick<HTMLButtonElement>({ enabled: enterApproves && !pending });

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        aria-keyshortcuts="Enter"
        busy={deciding === "approve"}
        disabled={deciding === "deny"}
        icon={<CheckIcon aria-hidden="true" />}
        name="decision"
        ref={approveRef}
        size="lg"
        type="submit"
        value="approve"
      >
        {t("Approve")}
        <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
      </Button>

      <Button
        busy={deciding === "deny"}
        disabled={deciding === "approve"}
        icon={<XIcon aria-hidden="true" />}
        name="decision"
        size="lg"
        type="submit"
        value="deny"
        variant="outline"
      >
        {t("Deny")}
      </Button>
    </div>
  );
}

function FailureNote({ failure }: { failure: CliLoginFailure }) {
  const t = useExtracted();
  const values = { command: LOGIN_COMMAND };

  const messages: Record<CliLoginFailure, string> = {
    expired: t("This code has expired. Run {command} again for a new one.", values),
    failed: t("That didn't work. Try again in a moment."),
    tooMany: t("Too many tries from this network. Wait 30 minutes, then try again."),
    used: t("This code was already used. Run {command} again for a new one.", values),
    wrong: t(
      "No login is waiting for this code. Check it against your terminal, or run {command} again.",
      values,
    ),
  };

  return (
    <p className="text-destructive-text text-sm" role="alert">
      {messages[failure]}
    </p>
  );
}

function Decided({ decision }: { decision: CliLoginDecision }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col items-start gap-2" role="status">
      {decision === "approve" ? (
        <CircleCheckIcon aria-hidden="true" className="text-success mb-2 size-6" />
      ) : (
        <CircleXIcon aria-hidden="true" className="text-muted-foreground mb-2 size-6" />
      )}

      <h2 className="text-section">
        {decision === "approve" ? t("You're logged in") : t("Login denied")}
      </h2>

      <p className="text-muted-foreground text-pretty">
        {decision === "approve"
          ? t("Go back to your terminal. The CLI is ready to use.")
          : t("The CLI got no access. You can close this page.")}
      </p>
    </div>
  );
}

export function CliLoginForm({ email, userCode }: { email: string; userCode?: string }) {
  const t = useExtracted();

  const [state, formAction] = useActionState(
    async (_previous: CliLoginState, formData: FormData): Promise<CliLoginState> => {
      const decision = formData.get("decision") === "deny" ? "deny" : "approve";
      const submittedCode = formData.get("userCode");

      return decideCliLogin({
        decision,
        userCode: typeof submittedCode === "string" ? submittedCode.trim() : "",
      }).catch((): CliLoginState => ({ failure: "failed" }));
    },
    null,
  );

  if (state && "decided" in state) {
    return <Decided decision={state.decided} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {userCode ? <CodeReadout userCode={userCode} /> : <CodeField />}

      <Grant email={email} />

      <div className="flex flex-col gap-4">
        <p className="flex gap-3 text-sm text-pretty">
          <ShieldAlertIcon aria-hidden="true" className="text-warning mt-0.5 size-4 shrink-0" />
          {t("Only approve a login you started yourself. If someone sent you this link, deny it.")}
        </p>

        <DecisionButtons enterApproves={Boolean(userCode)} />

        {state && "failure" in state && <FailureNote failure={state.failure} />}
      </div>
    </form>
  );
}
