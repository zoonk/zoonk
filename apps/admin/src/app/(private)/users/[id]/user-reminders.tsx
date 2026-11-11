import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { getUserStudyReminder } from "@/data/users/get-user-study-reminder";
import { type PushPlatform } from "@zoonk/db/enums";

const PLATFORM_NAMES = { android: "Android", ios: "iOS" } satisfies Record<PushPlatform, string>;

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
        <DetailField label="Push notifications">
          {push.on ? "On" : "Off"}
          {push.phone && (
            <span className="text-muted-foreground block">
              {push.phone.label} · {PLATFORM_NAMES[push.phone.platform]}
            </span>
          )}
        </DetailField>
        <DetailField label="Email">{email.on ? "On" : "Off"}</DetailField>
        <DetailField label="Time">
          {time} · {timeZone}
        </DetailField>

        {quiet && (
          <DetailField label="Paused">
            7 days without study; studying turns reminders back on
          </DetailField>
        )}
      </DetailFields>
    </AdminSection>
  );
}
