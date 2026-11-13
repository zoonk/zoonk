"use client";

import {
  type StudyReminderUpdateInput,
  type StudyReminderView,
} from "@zoonk/core/reminders/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { PauseIcon, UserPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useOptimistic } from "react";
import { ListGroup } from "../_components/list-group";
import { NoticeCard } from "../_components/notice-card";
import { PageSectionFooter } from "../_components/page";
import { SettingRow, SwitchSettingRow } from "../_components/setting-rows";
import { useOptimisticSave } from "../_utils/use-optimistic-save";
import { ReminderTimeSelect } from "./reminder-time";
import { useOtherZoneName } from "./reminder-zone";

export type ReminderChange = Pick<StudyReminderUpdateInput, "emailOn" | "pushOn" | "time">;

function applyChange(reminder: StudyReminderView, change: ReminderChange): StudyReminderView {
  return {
    ...reminder,
    email: { ...reminder.email, on: change.emailOn ?? reminder.email.on },
    push: { ...reminder.push, on: change.pushOn ?? reminder.push.on },
    time: change.time ?? reminder.time,
  };
}

function TimeSetting({
  namesZone,
  onChange,
  time,
  timeZone,
}: {
  namesZone: boolean;
  onChange: (time: string) => void;
  time: string;
  timeZone: string;
}) {
  const t = useExtracted();
  const otherZone = useOtherZoneName(timeZone);
  const zone = namesZone ? otherZone : null;
  const selectId = useId();
  const zoneId = useId();

  return (
    <SettingRow
      description={zone}
      descriptionId={zoneId}
      label={
        <label htmlFor={selectId}>
          {t({
            description: "The time of day a study reminder goes out, not an amount of time",
            id: "studyReminderTime",
            message: "Time",
          })}
        </label>
      }
    >
      <ReminderTimeSelect
        aria-describedby={zone ? zoneId : undefined}
        id={selectId}
        onChange={onChange}
        time={time}
      />
    </SettingRow>
  );
}

function GuestEmailSetting({ signUpHref }: { signUpHref: string }) {
  const t = useExtracted();

  return (
    <SettingRow description={t("Create an account to get email reminders")} label={t("Email")}>
      <PendingLink
        className={buttonVariants({ size: "sm", variant: "outline" })}
        href={signUpHref}
        icon={<UserPlusIcon aria-hidden="true" />}
      >
        {t("Create an account")}
      </PendingLink>
    </SettingRow>
  );
}

/** Push goes to the one phone picked in the Zoonk app; the web never asks for notifications. */
export function RemindersScreen({
  reminder,
  save,
  signUpHref,
}: {
  reminder: StudyReminderView;
  save: (change: ReminderChange) => Promise<boolean>;
  signUpHref: string;
}) {
  const t = useExtracted();
  const [view, applyOptimistic] = useOptimistic(reminder, applyChange);
  const { run } = useOptimisticSave();

  const change = (next: ReminderChange) =>
    run(
      () => applyOptimistic(next),
      () => save(next),
    );

  return (
    <div className="flex flex-col gap-7" data-slot="reminders-screen">
      <div className="flex flex-col gap-3">
        <ListGroup>
          <TimeSetting
            // Nothing is sent to a guest without the phone app, so no clock needs naming.
            namesZone={Boolean(view.email.address ?? view.push.phone)}
            onChange={(time) => change({ time })}
            time={view.time}
            timeZone={view.timeZone}
          />

          {view.email.address ? (
            <SwitchSettingRow
              checked={view.email.on}
              description={view.email.address}
              label={t("Email")}
              onCheckedChange={(emailOn) => change({ emailOn })}
            />
          ) : (
            <GuestEmailSetting signUpHref={signUpHref} />
          )}

          {view.push.phone && (
            <SwitchSettingRow
              checked={view.push.on}
              description={view.push.phone.label}
              label={t("Push notifications")}
              onCheckedChange={(pushOn) => change({ pushOn })}
            />
          )}
        </ListGroup>

        {!view.push.phone && (
          <PageSectionFooter>
            {t({
              description:
                "Stands in for the Push notifications row: name them in the same words as that row",
              message: "To get notifications on your phone, turn them on in the Zoonk phone app.",
            })}
          </PageSectionFooter>
        )}
      </div>

      {view.quiet && (
        <NoticeCard>
          <PauseIcon aria-hidden="true" />
          {t("Paused while you're away. Studying turns them back on.")}
        </NoticeCard>
      )}
    </div>
  );
}
