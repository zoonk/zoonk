import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { getUserLearningProfile } from "@/data/users/get-user-learning-profile";
import { getUserStudyReminder } from "@/data/users/get-user-study-reminder";
import { toWords } from "@/lib/format";
import { type PushPlatform } from "@zoonk/db/enums";

const PLATFORM_NAMES = { android: "Android", ios: "iOS" } satisfies Record<PushPlatform, string>;

export async function UserSettings({ userId }: { userId: string }) {
  "use cache: private";

  const profile = await getUserLearningProfile(userId);

  return (
    <AdminSection title="Their settings">
      {profile ? (
        <DetailFields>
          <DetailField label="Buddy">
            {[profile.buddyName, profile.buddyKind && toWords(profile.buddyKind)]
              .filter(Boolean)
              .join(" · ") || "—"}
          </DetailField>
          <DetailField label="Memory">{profile.memoryEnabled ? "On" : "Off"}</DetailField>
          <DetailField label="Sounds">{profile.soundsEnabled ? "On" : "Off"}</DetailField>
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
        <DetailField label="Push">
          {push.on ? "On" : "Off"}
          {push.phone && (
            <span className="text-muted-foreground">
              {" · "}
              {push.phone.label}, {PLATFORM_NAMES[push.phone.platform]}
            </span>
          )}
        </DetailField>
        <DetailField label="Email">{email.on ? "On" : "Off"}</DetailField>
        <DetailField label="Time">
          {time} <span className="text-muted-foreground">· {timeZone}</span>
        </DetailField>

        {quiet && (
          <DetailField label="Paused">
            After 7 days without study, until they study again
          </DetailField>
        )}
      </DetailFields>
    </AdminSection>
  );
}
