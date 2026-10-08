import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { getUserLearningProfile } from "@/data/users/get-user-learning-profile";
import { formatDate } from "@/lib/format";
import { CorrectBirthDialog } from "./correct-birth-dialog";

const MONTHS_PER_YEAR = 12;

/**
 * Age in whole years from the stored birth month and year (the least data that tells who is
 * under 13, 16 or 18). The day isn't stored, so the birthday month counts as passed.
 */
function getAge({ month, year }: { month: number | null; year: number | null }): string {
  if (!year) {
    return "Unknown";
  }

  const now = new Date();

  const monthsOld =
    (now.getFullYear() - year) * MONTHS_PER_YEAR + (now.getMonth() + 1 - (month ?? 1));

  const age = Math.floor(monthsOld / MONTHS_PER_YEAR);

  return `${age} (born ${month ? `${month}/` : ""}${year})`;
}

/** Null means the learner never chose, so their age decides: on for adults, off for minors. */
function getMemoryChoice(enabled: boolean | null) {
  if (enabled === null) {
    return "Not chosen (on for adults, off under 18)";
  }

  return enabled ? "On" : "Off";
}

/**
 * How the learner set Zoonk up and the age and guardian facts that decide protections, so
 * support can explain why a minor sees a limit or can't buy Plus.
 */
export async function UserLearningProfile({ userId }: { userId: string }) {
  "use cache: private";

  const { guardianLinks, profile } = await getUserLearningProfile(userId);

  return (
    <AdminSection title="Learning profile">
      {profile ? (
        <dl>
          <DetailField label="Buddy">
            {[profile.buddyName, profile.buddyKind].filter(Boolean).join(" · ") || "—"}
          </DetailField>
          <DetailField label="Age">
            <span className="flex items-center justify-end gap-2">
              {getAge({ month: profile.birthMonth, year: profile.birthYear })}
              <CorrectBirthDialog
                birthMonth={profile.birthMonth}
                birthYear={profile.birthYear}
                userId={userId}
              />
            </span>
          </DetailField>
          <DetailField label="Active goal">{profile.activeGoal?.title ?? "—"}</DetailField>
          <DetailField label="Memory">{getMemoryChoice(profile.memoryEnabled)}</DetailField>
          <DetailField label="Sounds">{profile.soundsEnabled ? "On" : "Off"}</DetailField>
          <DetailField label="Own daily limit">
            {profile.dailyLimitMinutes ? `${profile.dailyLimitMinutes} min` : "—"}
          </DetailField>
        </dl>
      ) : (
        <AdminSectionEmpty>No learning profile yet.</AdminSectionEmpty>
      )}

      <dl className="mt-2">
        <DetailField label="Guardian">
          {guardianLinks.length === 0 ? (
            "No guardian link"
          ) : (
            <ul className="flex flex-col items-end gap-1">
              {guardianLinks.map((link) => (
                <li key={link.id}>
                  <span className="capitalize">{link.status}</span>
                  <span className="text-muted-foreground text-xs">
                    {" · invited "}
                    {formatDate(link.createdAt)}
                    {link.acceptedAt ? ` · accepted ${formatDate(link.acceptedAt)}` : ""}
                    {link.dailyLimitMinutes ? ` · ${link.dailyLimitMinutes} min a day` : ""}
                    {link.memoryOff ? " · memory off" : ""}
                    {link.plusApprovedAt
                      ? ` · Plus approved ${formatDate(link.plusApprovedAt)}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DetailField>
      </dl>
    </AdminSection>
  );
}
