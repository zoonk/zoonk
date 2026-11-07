"use client";

import { type StudyReminderView } from "@zoonk/core/reminders/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { safeAsync } from "@zoonk/utils/error";
import { BellIcon, UserPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { useTimeZoneName } from "../_utils/locale";
import { useFormatTimeOfDay } from "../_utils/time-format";
import { type StudyMomentView } from "../session/session-types";
import { ReminderTimeSelect } from "./reminder-time";

export type ReminderOfferActions = {
  /** True only for the call that marked the offer shown. */
  claim: () => Promise<boolean>;
  load: () => Promise<StudyReminderView | null>;
  remindByEmail: (time: string) => Promise<boolean>;
  signUpHref: string;
};

/** The offer counts as shown once half the card is on screen; a learner who never scrolls to it keeps it. */
const SEEN_SHARE = 0.5;

function useLoadedReminder(load: ReminderOfferActions["load"]) {
  const [reminder, setReminder] = useState<StudyReminderView | null>(null);

  useEffect(() => {
    void safeAsync(load).then(({ data }) => setReminder(data));
  }, [load]);

  return reminder;
}

/** Once per learner: a refused claim (already shown, here or on another device) hides the card. */
function useClaimOnce({
  claim,
  onRefused,
}: {
  claim: () => Promise<boolean>;
  onRefused: () => void;
}) {
  const claimed = useRef(false);

  return useCallback(() => {
    if (claimed.current) {
      return;
    }

    claimed.current = true;

    void safeAsync(claim).then(({ data }) => {
      if (data === false) {
        onRefused();
      }
    });
  }, [claim, onRefused]);
}

function useSeenRef(onSeen: () => void) {
  return useCallback(
    (node: HTMLElement | null) => {
      if (!node) {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.intersectionRatio >= SEEN_SHARE)) {
            observer.disconnect();
            onSeen();
          }
        },
        { threshold: SEEN_SHARE },
      );

      observer.observe(node);
      return () => observer.disconnect();
    },
    [onSeen],
  );
}

function OfferFrame({
  children,
  description,
  onSeen,
}: {
  children?: React.ReactNode;
  description: React.ReactNode;
  onSeen: () => void;
}) {
  const t = useExtracted();
  const titleId = useId();
  const seenRef = useSeenRef(onSeen);

  return (
    <section
      aria-labelledby={titleId}
      className="border-border flex items-start gap-3 border-y py-2.75"
      data-slot="reminder-offer"
      ref={seenRef}
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
  onSeen,
  signUpHref,
  time,
}: {
  onClose: () => void;
  onSeen: () => void;
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
      onSeen={onSeen}
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
  onSeen,
  remindByEmail,
  suggestedTime,
  timeZone,
}: {
  address: string;
  onClose: () => void;
  onSeen: () => void;
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
    return <OfferFrame description={t("Email reminders are on.")} onSeen={onSeen} />;
  }

  return (
    <OfferFrame
      description={t(
        "We'll email {address} at {time} on your study days, when you still have learning left.",
        { address, time: formatTime(time) },
      )}
      onSeen={onSeen}
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

function LoadedOffer({ actions, time }: { actions: ReminderOfferActions; time: string }) {
  const reminder = useLoadedReminder(actions.load);
  const [closed, setClosed] = useState(false);
  const close = useCallback(() => setClosed(true), []);
  const claim = useClaimOnce({ claim: actions.claim, onRefused: close });

  if (!reminder || closed) {
    return null;
  }

  return reminder.email.address ? (
    <EmailOffer
      address={reminder.email.address}
      onClose={close}
      onSeen={claim}
      remindByEmail={actions.remindByEmail}
      suggestedTime={time}
      timeZone={reminder.timeZone}
    />
  ) : (
    <GuestOffer onClose={close} onSeen={claim} signUpHref={actions.signUpHref} time={time} />
  );
}

export function ReminderOffer({
  actions,
  offer,
}: {
  actions?: ReminderOfferActions;
  offer: StudyMomentView["reminderOffer"];
}) {
  return actions && offer ? <LoadedOffer actions={actions} time={offer.time} /> : null;
}
