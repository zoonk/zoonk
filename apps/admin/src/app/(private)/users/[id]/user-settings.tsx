import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { StateMark } from "@/components/state-mark";
import { getUserLearningProfile } from "@/data/users/get-user-learning-profile";
import { getUserStudyReminder } from "@/data/users/get-user-study-reminder";
import { toWords } from "@/lib/format";
import { type PushPlatform } from "@zoonk/db/enums";
import {
  BellOffIcon,
  BrainIcon,
  ClockIcon,
  MailIcon,
  SmartphoneIcon,
  SmileIcon,
  Volume2Icon,
} from "lucide-react";

const PLATFORM_NAMES = { android: "Android", ios: "iOS" } satisfies Record<PushPlatform, string>;

/** A switch as its state's mark: on is the blue check, off is gray. */
function OnOff({ on }: { on: boolean }) {
  return (
    <StateMark state={on ? "on" : "off"} tone={on ? "done" : "off"}>
      {on ? "On" : "Off"}
    </StateMark>
  );
}

export async function UserSettings({ userId }: { userId: string }) {
  "use cache: private";

  const profile = await getUserLearningProfile(userId);

  return (
    <AdminSection title="Their settings">
      {profile ? (
        <DetailFields>
          <DetailField icon={<SmileIcon aria-hidden="true" />} label="Buddy">
            {[profile.buddyName, profile.buddyKind && toWords(profile.buddyKind)]
              .filter(Boolean)
              .join(" · ") || "—"}
          </DetailField>
          <DetailField icon={<BrainIcon aria-hidden="true" />} label="Memory">
            <OnOff on={profile.memoryEnabled} />
          </DetailField>
          <DetailField icon={<Volume2Icon aria-hidden="true" />} label="Sounds">
            <OnOff on={profile.soundsEnabled} />
          </DetailField>
        </DetailFields>
      ) : (
        <AdminSectionEmpty>They haven&apos;t started learning yet.</AdminSectionEmpty>
      )}
    </AdminSection>
  );
}

export async function UserReminders({ userId }: { userId: string }) {
  "use cache: private";

  const reminder = await getUserStudyReminder(userId);

  if (!reminder) {
    return null;
  }

  const { email, push, quiet, time, timeZone } = reminder;

  return (
    <AdminSection title="Reminders">
      <DetailFields>
        <DetailField icon={<SmartphoneIcon aria-hidden="true" />} label="Push">
          <OnOff on={push.on} />
          {push.phone && (
            <span className="text-muted-foreground">
              {" · "}
              {push.phone.label}, {PLATFORM_NAMES[push.phone.platform]}
            </span>
          )}
        </DetailField>
        <DetailField icon={<MailIcon aria-hidden="true" />} label="Email">
          <OnOff on={email.on} />
        </DetailField>
        <DetailField icon={<ClockIcon aria-hidden="true" />} label="Time">
          {time} <span className="text-muted-foreground">· {timeZone}</span>
        </DetailField>

        {quiet && (
          <DetailField icon={<BellOffIcon aria-hidden="true" />} label="Paused">
            After 7 days without study, until they study again
          </DetailField>
        )}
      </DetailFields>
    </AdminSection>
  );
}
