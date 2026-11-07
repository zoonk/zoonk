"use client";

import { type StudyReminderView } from "@zoonk/core/reminders/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { safeAsync } from "@zoonk/utils/error";
import { BellIcon, UserPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { useTimeZoneName } from "../_utils/locale";
import { useFormatTimeOfDay } from "../_utils/time-format";
import { type StudyMomentView } from "../session/session-types";
import { ReminderTimeSelect } from "./reminder-time";

export type ReminderOfferActions = {
  /** Resolves to the learner's reminder settings only for the call that marked the offer shown. */
  claim: () => Promise<StudyReminderView | null>;
  remindByEmail: (time: string) => Promise<boolean>;
  signUpHref: string;
};

/** Once per learner: a second claim, after a remount or on another device, hides the card. */
function useClaimedReminder(claim: ReminderOfferActions["claim"]) {
  const [reminder, setReminder] = useState<StudyReminderView | null>(null);
  const claimed = useRef(false);

  useEffect(() => {
    if (claimed.current) {
      return;
    }

    claimed.current = true;
    void safeAsync(claim).then(({ data }) => setReminder(data));
  }, [claim]);

  return reminder;
}

function OfferFrame({
  children,
  description,
}: {
  children?: React.ReactNode;
  description: React.ReactNode;
}) {
  const t = useExtracted();
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="border-border flex items-start gap-3 border-y py-2.75"
      data-slot="reminder-offer"
    >
      <BellIcon aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium" id={titleId}>
            {t("Want a study reminder?")}
          </p>
          <p
            className="text-muted-foreground text-xs leading-5 text-pretty wrap-anywhere"
            role="status"
          >
            {description}
          </p>
        </div>

        {children}
      </div>
    </section>
  );
}

function GuestOffer({
  onClose,
  signUpHref,
  time,
}: {
  onClose: () => void;
  signUpHref: string;
  time: string;
}) {
  const t = useExtracted();
  const formatTime = useFormatTimeOfDay();

  return (
    <OfferFrame
      description={t("At {time} on your study days, when you still have learning left.", {
        time: formatTime(time),
      })}
    >
      <div className="flex flex-wrap gap-2">
        <PendingLink
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href={signUpHref}
          icon={<UserPlusIcon aria-hidden="true" />}
        >
          {t("Create an account to get email reminders")}
        </PendingLink>
        <Button onClick={onClose} size="sm" variant="ghost">
          {t("No thanks")}
        </Button>
      </div>
    </OfferFrame>
  );
}

function EmailOffer({
  address,
  onClose,
  remindByEmail,
  suggestedTime,
  timeZone,
}: {
  address: string;
  onClose: () => void;
  remindByEmail: ReminderOfferActions["remindByEmail"];
  suggestedTime: string;
  timeZone: string;
}) {
  const t = useExtracted();
  const formatTime = useFormatTimeOfDay();
  const zone = useTimeZoneName(timeZone);
  const selectId = useId();
  const [time, setTime] = useState(suggestedTime);
  const [result, setResult] = useState<"failed" | "saved" | null>(null);
  const [isSaving, startSaving] = useTransition();

  const remind = () =>
    startSaving(async () => {
      const { data: saved } = await safeAsync(() => remindByEmail(time));
      setResult(saved ? "saved" : "failed");
    });

  if (result === "saved") {
    return <OfferFrame description={t("Email reminders are on.")} />;
  }

  return (
    <OfferFrame
      description={t(
        "We'll email {address} at {time} on your study days, when you still have learning left.",
        { address, time: formatTime(time) },
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <label className="sr-only" htmlFor={selectId}>
          {t("Reminder time")}
        </label>
        <ReminderTimeSelect id={selectId} onChange={setTime} time={time} />
        <span className="text-muted-foreground text-xs">{zone}</span>
      </div>

      {result === "failed" && <ChangeSaveError />}

      <div className="flex flex-wrap gap-2">
        <Button
          busy={isSaving}
          icon={<BellIcon aria-hidden="true" />}
          onClick={remind}
          size="sm"
          variant="outline"
        >
          {t("Remind me")}
        </Button>
        <Button disabled={isSaving} onClick={onClose} size="sm" variant="ghost">
          {t("No thanks")}
        </Button>
      </div>
    </OfferFrame>
  );
}

function ClaimedOffer({ actions, time }: { actions: ReminderOfferActions; time: string }) {
  const reminder = useClaimedReminder(actions.claim);
  const [closed, setClosed] = useState(false);

  if (!reminder || closed) {
    return null;
  }

  const close = () => setClosed(true);

  return reminder.email.address ? (
    <EmailOffer
      address={reminder.email.address}
      onClose={close}
      remindByEmail={actions.remindByEmail}
      suggestedTime={time}
      timeZone={reminder.timeZone}
    />
  ) : (
    <GuestOffer onClose={close} signUpHref={actions.signUpHref} time={time} />
  );
}

export function ReminderOffer({
  actions,
  offer,
}: {
  actions?: ReminderOfferActions;
  offer: StudyMomentView["reminderOffer"];
}) {
  return actions && offer ? <ClaimedOffer actions={actions} time={offer.time} /> : null;
}
