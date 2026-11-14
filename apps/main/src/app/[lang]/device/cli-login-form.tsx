"use client";

import { COLUMN_CONTENT_CLASS } from "@/components/public/column-screen";
import { EnterButton } from "@zoonk/learn/enter-button";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Button } from "@zoonk/ui/components/button";
import { Field, FieldLabel } from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { cn } from "@zoonk/ui/lib/utils";
import {
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  EyeIcon,
  FilePenLineIcon,
  PencilOffIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import {
  type CliLoginFailure,
  type CliLoginOutcome,
  type CliLoginState,
  decideCliLogin,
} from "./decide-cli-login";

const LOGIN_COMMAND = "pnpm zoonk login";

type FormState =
  | { outcome: CliLoginOutcome }
  | { failure: CliLoginFailure; userCode: string }
  | null;

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

/**
 * Enter in the field presses Approve, as a click would (so not while a decision is running): a
 * form's own Enter would press its first button, Deny.
 */
function CodeField({
  approveId,
  defaultValue,
  errorId,
}: {
  approveId: string;
  defaultValue?: string;
  errorId?: string;
}) {
  const t = useExtracted();
  const id = useId();

  const approveOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const approve = event.currentTarget.form?.elements.namedItem(approveId);

    if (
      event.key !== "Enter" ||
      event.nativeEvent.isComposing ||
      !(approve instanceof HTMLButtonElement)
    ) {
      return;
    }

    event.preventDefault();
    approve.click();
  };

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("Code from your terminal")}</FieldLabel>
      <Input
        aria-describedby={errorId}
        aria-invalid={errorId ? true : undefined}
        autoCapitalize="characters"
        autoComplete="off"
        className="font-mono uppercase"
        defaultValue={defaultValue}
        id={id}
        name="userCode"
        onKeyDown={approveOnEnter}
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
          <FilePenLineIcon
            aria-hidden="true"
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
          />
          {t(
            "It can propose fixes to course content. Each one waits until a person approves it in Admin with a passkey.",
          )}
        </li>
        <li className="flex gap-3">
          <PencilOffIcon
            aria-hidden="true"
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
          />
          {t("It can't change anything by itself.")}
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

/** Deny, then Approve as the bar's main action. Enter alone never approves a login: the learner presses it. */
function DecisionButtons({ approveId }: { approveId: string }) {
  const t = useExtracted();
  const { data, pending } = useFormStatus();
  const deciding = pending ? data?.get("decision") : null;

  return (
    <BottomBarActions>
      <Button
        busy={deciding === "deny"}
        disabled={deciding === "approve"}
        name="decision"
        size="xl"
        type="submit"
        value="deny"
        variant="outline"
      >
        {t("Deny")}
      </Button>

      <EnterButton
        busy={deciding === "approve"}
        disabled={deciding === "deny"}
        enter="off"
        id={approveId}
        name="decision"
        type="submit"
        value="approve"
      >
        {t("Approve")}
      </EnterButton>
    </BottomBarActions>
  );
}

function FailureNote({ failure, id }: { failure: CliLoginFailure; id: string }) {
  const t = useExtracted();
  const values = { command: LOGIN_COMMAND };

  const messages: Record<CliLoginFailure, string> = {
    expired: t("This code has expired. Run {command} again for a new one.", values),
    failed: t("That didn't work. Try again in a moment."),
    tooMany: t(
      "Too many tries from this network. Wait 30 minutes, then run {command} again.",
      values,
    ),
    used: t("This code was already used. Run {command} again for a new one.", values),
    wrong: t(
      "No login is waiting for this code. Check it against your terminal, or run {command} again.",
      values,
    ),
  };

  return (
    <p className="text-destructive-text text-sm" id={id} role="alert">
      {messages[failure]}
    </p>
  );
}

function Outcome({ email, outcome }: { email: string; outcome: CliLoginOutcome }) {
  const t = useExtracted();
  const approved = outcome === "approved";

  const text: Record<CliLoginOutcome, { body: string; title: string }> = {
    approved: {
      body: t("Go back to your terminal. The CLI is ready to use."),
      title: t("You're logged in"),
    },
    denied: {
      body: t("The CLI got no access. You can close this page."),
      title: t("Login denied"),
    },
    needsStaff: {
      body: t(
        "The CLI got no access, because {email} isn't a staff account. Log in with your staff account, then run {command} again.",
        { command: LOGIN_COMMAND, email },
      ),
      title: t("This login needs a Zoonk staff account"),
    },
  };

  return (
    <div className="flex flex-col items-start gap-2" role="status">
      {approved ? (
        <CircleCheckIcon aria-hidden="true" className="text-success mb-2 size-6" />
      ) : (
        <CircleXIcon aria-hidden="true" className="text-muted-foreground mb-2 size-6" />
      )}

      <h2 className="text-section outline-none" ref={(node) => node?.focus()} tabIndex={-1}>
        {text[outcome].title}
      </h2>
      <p className="text-muted-foreground text-pretty">{text[outcome].body}</p>
    </div>
  );
}

export function CliLoginForm({ email, userCode }: { email: string; userCode?: string }) {
  const t = useExtracted();

  const errorId = useId();
  const approveId = useId();

  const [state, formAction] = useActionState(
    async (_previous: FormState, formData: FormData): Promise<FormState> => {
      const decision = formData.get("decision") === "deny" ? "deny" : "approve";
      const submittedCode = formData.get("userCode");
      const typedCode = typeof submittedCode === "string" ? submittedCode.trim() : "";

      const result = await decideCliLogin({ decision, userCode: typedCode }).catch(
        (): CliLoginState => ({ failure: "failed" }),
      );

      return result && "failure" in result ? { ...result, userCode: typedCode } : result;
    },
    null,
  );

  const failed = state && "failure" in state ? state : null;

  if (state && "outcome" in state) {
    return <Outcome email={email} outcome={state.outcome} />;
  }

  return (
    <form action={formAction} className="contents">
      <div className={cn(COLUMN_CONTENT_CLASS, "mt-2 flex flex-1 flex-col gap-8")}>
        {userCode ? (
          <CodeReadout userCode={userCode} />
        ) : (
          <CodeField
            approveId={approveId}
            defaultValue={failed?.userCode}
            errorId={failed ? errorId : undefined}
          />
        )}

        <Grant email={email} />

        <p className="flex gap-3 text-sm text-pretty">
          <ShieldAlertIcon aria-hidden="true" className="text-warning mt-0.5 size-4 shrink-0" />
          {t("Only approve a login you started yourself. If someone sent you this link, deny it.")}
        </p>
      </div>

      <BottomBar note={failed && <FailureNote failure={failed.failure} id={errorId} />}>
        <DecisionButtons approveId={approveId} />
      </BottomBar>
    </form>
  );
}
