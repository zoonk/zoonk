"use client";

import { type GuardianLinkView } from "@zoonk/core/minors/guardian/contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted, useFormatter } from "next-intl";
import { useState, useTransition } from "react";
import { cancelGuardianInviteAction } from "./actions";

/** A long address wraps after the @ first, keeping the domain whole ("…santos@ / example.com"). */
function GuardianEmail({ email }: { email: string }) {
  const at = email.lastIndexOf("@");

  if (at === -1) {
    return email;
  }

  return (
    <>
      {email.slice(0, at + 1)}
      <wbr />
      {email.slice(at + 1)}
    </>
  );
}

function ActiveLinkDetails({ link }: { link: GuardianLinkView }) {
  const t = useExtracted();

  return (
    <ul className="text-muted-foreground flex flex-col gap-0.5 text-sm">
      <li>
        {link.dailyLimitMinutes === null
          ? t("No daily time limit")
          : t("Daily limit: {minutes} min", { minutes: String(link.dailyLimitMinutes) })}
      </li>
      {link.plusApprovedAt && <li>{t("Plus approved")}</li>}
      <li>{t("Only your guardian can end this link.")}</li>
    </ul>
  );
}

function PendingInvite({ link }: { link: GuardianLinkView }) {
  const t = useExtracted();
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const cancel = () => {
    startTransition(async () => {
      setFailed(!(await cancelGuardianInviteAction(link.id)));
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm">
        {link.expiresAt
          ? t("Waiting for them to accept. The invite works until {date}.", {
              // A short month ends in a period in some languages ("4 de out."), doubling the
              // sentence's.
              date: format.dateTime(link.expiresAt, { day: "numeric", month: "long" }),
            })
          : t("Waiting for them to accept.")}
      </p>
      <Button className="w-fit" disabled={isPending} onClick={cancel} size="sm" variant="outline">
        {t("Cancel invite")}
      </Button>
      {failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't cancel the invite. Try again.")}
        </p>
      )}
    </div>
  );
}

/** Guardians and invites: who can see the week, set a daily limit and approve Plus. */
export function GuardianLinks({ links }: { links: GuardianLinkView[] }) {
  const t = useExtracted();

  return (
    <ul className="border-border in-data-[mode=fun]:fun-glass divide-border divide-y rounded-2xl border">
      {links.map((link) => (
        <li className="flex flex-col gap-2 px-4 py-3.5" key={link.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-base font-medium wrap-anywhere">
              <GuardianEmail email={link.guardianEmail} />
            </p>
            <span className="bg-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
              {link.status === "active" ? t("Guardian") : t("Invite sent")}
            </span>
          </div>

          {link.status === "active" ? (
            <ActiveLinkDetails link={link} />
          ) : (
            <PendingInvite link={link} />
          )}
        </li>
      ))}
    </ul>
  );
}
