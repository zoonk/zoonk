import { getUser } from "@/data/users/get-user";
import { Separator } from "@zoonk/ui/components/separator";
import { DetailField } from "./detail-field";

export async function UserActivity({ userId }: { userId: number }) {
  const user = await getUser(userId);

  if (!user) {
    return null;
  }

  const { progress, members, _count } = user;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Activity</h3>
      <Separator />

      <dl className="mt-2">
        <DetailField label="Brain power">
          {progress ? Number(progress.totalBrainPower).toLocaleString() : "0"}
        </DetailField>

        <DetailField label="Current energy">{progress?.currentEnergy ?? 0}</DetailField>

        <DetailField label="Last active">
          {progress?.lastActiveAt ? new Date(progress.lastActiveAt).toLocaleDateString() : "—"}
        </DetailField>

        <DetailField label="Courses owned">{_count.ownedCourses}</DetailField>

        <DetailField label="Organizations">
          {members.length > 0
            ? members.map((member) => `${member.organization.name} (${member.role})`).join(", ")
            : "—"}
        </DetailField>
      </dl>
    </section>
  );
}
