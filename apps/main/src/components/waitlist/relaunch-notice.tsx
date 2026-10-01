"use client";

import { sendFeedbackRequest } from "@/components/feedback/feedback-request";
import { authClient } from "@zoonk/auth/client";
import { parseFormField } from "@zoonk/utils/form";
import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  WaitlistField,
  WaitlistFieldLabel,
  WaitlistForm,
  WaitlistInput,
  type WaitlistState,
  WaitlistStatus,
  WaitlistSubmit,
} from "./waitlist";

async function joinRelaunchWaitlist(
  _previousState: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = parseFormField(formData, "email");

  if (!email) {
    return { status: "error" };
  }

  const sent = await sendFeedbackRequest({ email, message: "New Zoonk waitlist request" });

  return { status: sent ? "success" : "error" };
}

export function RelaunchNotice() {
  const t = useExtracted();
  const { data: session } = authClient.useSession();
  const [email, setEmail] = useState<string | null>(null);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 px-4 py-12 sm:py-20">
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm font-medium">{t("Coming soon")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t("A new Zoonk is on the way")}
        </h1>
        <p className="text-muted-foreground leading-relaxed text-pretty">
          {t(
            "We're rethinking how Zoonk works. A new version will be available soon. Join the waitlist and we'll email you when it's ready.",
          )}
        </p>
      </div>

      <WaitlistForm action={joinRelaunchWaitlist}>
        <WaitlistField>
          <WaitlistFieldLabel>{t("Email address")}</WaitlistFieldLabel>
          <WaitlistInput
            autoComplete="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email ?? session?.user.email ?? ""}
          />
        </WaitlistField>

        <WaitlistStatus
          errorMessage={t("We couldn't add you to the waitlist. Please try again.")}
          successMessage={t("You're on the list. We'll email you when it's available.")}
        />

        <WaitlistSubmit full>{t("Notify me")}</WaitlistSubmit>
      </WaitlistForm>
    </main>
  );
}
