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
import { ChangeSaveError } from "../_components/save-error";
import { SettingRow, SwitchSettingRow } from "../_components/setting-rows";
import { useTimeZoneName } from "../_utils/locale";
import { useOptimisticSave } from "../_utils/use-optimistic-save";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { ReminderTimeSelect } from "./reminder-time";

export type ReminderChange = Pick<StudyReminderUpdateInput, "emailOn" | "pushOn" | "time">;

function applyChange(reminder: StudyReminderView, change: ReminderChange): StudyReminderView {
  return {
    ...reminder,
    email: { ...reminder.email, on: change.emailOn ?? reminder.email.on },
    push: { ...reminder.push, on: change.pushOn ?? reminder.push.on },
    time: change.time ?? reminder.time,
  };
}

function PlansLink({ children }: { children: React.ReactNode }) {
  return <LearnLink href={useLearnRoutes().journey}>{children}</LearnLink>;
}

function renderPlansLink(chunks: React.ReactNode) {
  return <PlansLink>{chunks}</PlansLink>;
}

function TimeSetting({
  onChange,
  time,
  timeZone,
}: {
  onChange: (time: string) => void;
  time: string;
  timeZone: string;
}) {
  const t = useExtracted();
  const zone = useTimeZoneName(timeZone);
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
      <ReminderTimeSelect aria-describedby={zoneId} id={selectId} onChange={onChange} time={time} />
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
  const { failed, run } = useOptimisticSave();

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
              message: "To get push notifications, turn them on in the Zoonk app.",
            })}
          </PageSectionFooter>
        )}

        <PageSectionFooter>
          {t.rich("On your study days, from your <link>plans</link>", { link: renderPlansLink })}
        </PageSectionFooter>
      </div>

      {view.quiet && (
        <NoticeCard>
          <PauseIcon aria-hidden="true" />
          {t("Paused while you're away. Studying turns them back on.")}
        </NoticeCard>
      )}

      {failed && <ChangeSaveError />}
    </div>
  );
}
