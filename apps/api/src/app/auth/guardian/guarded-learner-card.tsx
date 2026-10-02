"use client";

import { DAILY_LIMIT_CHOICES, type GuardedLearnerView } from "@zoonk/core/minors/guardian/contract";
import { Button } from "@zoonk/ui/components/button";
import { Label } from "@zoonk/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { useExtracted, useFormatter } from "next-intl";
import { useId, useState, useTransition } from "react";
import { approvePlusAction, setDailyLimitAction } from "./actions";
import { EndLinkButton } from "./end-link-button";

const NO_LIMIT = "none";

function DailyLimitForm({ learner }: { learner: GuardedLearnerView }) {
  const t = useExtracted();
  const selectId = useId();
  const [value, setValue] = useState(learner.dailyLimitMinutes?.toString() ?? NO_LIMIT);
  const [status, setStatus] = useState<"failed" | "idle" | "saved">("idle");
  const [isPending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const saved = await setDailyLimitAction({
        dailyLimitMinutes: value === NO_LIMIT ? null : Number(value),
        linkId: learner.linkId,
      });

      setStatus(saved ? "saved" : "failed");
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={selectId}>{t("Daily time limit")}</Label>
      <div className="flex items-center gap-2">
        <NativeSelect
          id={selectId}
          onChange={(event) => {
            setValue(event.target.value);
            setStatus("idle");
          }}
          value={value}
        >
          <NativeSelectOption value={NO_LIMIT}>{t("No limit")}</NativeSelectOption>
          {DAILY_LIMIT_CHOICES.map((minutes) => (
            <NativeSelectOption key={minutes} value={String(minutes)}>
              {t("{minutes} min a day", { minutes: String(minutes) })}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button className="h-11 px-4" disabled={isPending} onClick={save} variant="outline">
          {t("Save")}
        </Button>
      </div>
      {status === "saved" && (
        <p className="text-success text-sm" role="status">
          {t("Daily limit saved")}
        </p>
      )}
      {status === "failed" && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't save the limit. Try again.")}
        </p>
      )}
    </div>
  );
}

function PlusApproval({ learner }: { learner: GuardedLearnerView }) {
  const t = useExtracted();
  const format = useFormatter();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (learner.plusApprovedAt) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("You approved Plus on {date}.", {
          date: format.dateTime(learner.plusApprovedAt, { day: "numeric", month: "short" }),
        })}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm">
        {t("{name} needs your approval to subscribe to Plus.", { name: learner.learnerName })}
      </p>
      <Button
        className="w-fit"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            setFailed(!(await approvePlusAction(learner.linkId)));
          });
        }}
        size="sm"
      >
        {t("Approve Plus")}
      </Button>
      {failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't save your approval. Try again.")}
        </p>
      )}
    </div>
  );
}

/** Bars reach full height on the week's busiest day; a quiet day keeps a sliver so it reads as zero. */
const MIN_BAR_PERCENT = 4;
const FULL_BAR_PERCENT = 100;

function getBarHeight({ minutes, busiest }: { busiest: number; minutes: number }) {
  if (busiest === 0) {
    return MIN_BAR_PERCENT;
  }

  return Math.max(MIN_BAR_PERCENT, Math.round((minutes / busiest) * FULL_BAR_PERCENT));
}

/** Minutes studied each of the last seven days, with the lessons finished, as small bars. */
function WeekActivity({ days }: { days: GuardedLearnerView["weeklyActivity"]["days"] }) {
  const t = useExtracted();
  const format = useFormatter();
  const busiest = Math.max(0, ...days.map((day) => day.minutes));

  return (
    <ol aria-label={t("Minutes each day")} className="grid grid-cols-7 items-end gap-1.5">
      {days.map((day) => (
        <li className="flex flex-col items-center gap-1" key={day.date.toISOString()}>
          <span className="text-muted-foreground text-xs tabular-nums">{day.minutes}</span>
          <span aria-hidden="true" className="bg-muted flex h-16 w-full items-end rounded-md">
            <span
              className="bg-primary w-full rounded-md"
              style={{ height: `${getBarHeight({ busiest, minutes: day.minutes })}%` }}
            />
          </span>
          <span className="text-muted-foreground text-xs">
            {format.dateTime(day.date, { timeZone: "UTC", weekday: "narrow" })}
          </span>
          <span className="sr-only">
            {t(
              "{day}: {minutes, plural, one {# minute} other {# minutes}}, {lessons, plural, one {# lesson} other {# lessons}}",
              {
                day: format.dateTime(day.date, { timeZone: "UTC", weekday: "long" }),
                lessons: day.lessonsCompleted,
                minutes: day.minutes,
              },
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** One learner: the last seven days, their daily limit and Plus approval. */
export function GuardedLearnerCard({ learner }: { learner: GuardedLearnerView }) {
  const t = useExtracted();
  const { lessonsCompleted, minutes } = learner.weeklyActivity;

  return (
    <section
      aria-label={learner.learnerName}
      className="border-border flex flex-col gap-5 rounded-2xl border p-4"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{learner.learnerName}</h2>
        <p className="text-muted-foreground text-sm">
          {t(
            "Last 7 days: {minutes, plural, one {# minute} other {# minutes}} and {lessons, plural, one {# lesson} other {# lessons}}",
            { lessons: lessonsCompleted, minutes },
          )}
        </p>
      </header>

      {learner.weeklyActivity.days.length > 0 && (
        <WeekActivity days={learner.weeklyActivity.days} />
      )}
      <DailyLimitForm learner={learner} />
      <PlusApproval learner={learner} />
      <EndLinkButton learnerName={learner.learnerName} linkId={learner.linkId} />
    </section>
  );
}
