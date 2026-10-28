import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { getUserLearningProfile } from "@/data/users/get-user-learning-profile";

export async function UserLearningProfile({ userId }: { userId: string }) {
  "use cache: private";

  const profile = await getUserLearningProfile(userId);

  return (
    <AdminSection title="Learning profile">
      {profile ? (
        <dl>
          <DetailField label="Buddy">
            {[profile.buddyName, profile.buddyKind].filter(Boolean).join(" · ") || "—"}
          </DetailField>
          <DetailField label="Active goal">{profile.activeGoal?.title ?? "—"}</DetailField>
          <DetailField label="Memory">{profile.memoryEnabled ? "On" : "Off"}</DetailField>
          <DetailField label="Sounds">{profile.soundsEnabled ? "On" : "Off"}</DetailField>
          <DetailField label="Daily limit">
            {profile.dailyLimitMinutes ? `${profile.dailyLimitMinutes} min` : "—"}
          </DetailField>
        </dl>
      ) : (
        <AdminSectionEmpty>No learning profile yet.</AdminSectionEmpty>
      )}
    </AdminSection>
  );
}
