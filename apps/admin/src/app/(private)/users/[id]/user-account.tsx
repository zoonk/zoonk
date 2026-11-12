import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { getUser } from "@/data/users/get-user";
import { formatDate, toWords } from "@/lib/format";
import { Avatar, AvatarImage } from "@zoonk/ui/components/avatar";

export async function UserAccount({ userId }: { userId: string }) {
  "use cache: private";

  const user = await getUser(userId);

  if (!user) {
    return null;
  }

  const lastSignIn = user.sessions[0]?.updatedAt;
  const providers = user.accounts.map((account) => toWords(account.providerId));

  return (
    <AdminSection title="Account">
      <DetailFields>
        {user.image && (
          <DetailField label="Photo">
            <Avatar>
              <AvatarImage alt={user.name} src={user.image} />
            </Avatar>
          </DetailField>
        )}
        <DetailField label="Email">
          {user.email}
          {user.emailVerified ? null : <span className="text-warning-text"> · not verified</span>}
        </DetailField>
        <DetailField label="Username">{user.username ? `@${user.username}` : "—"}</DetailField>
        <DetailField label="Signs in with">{providers.join(", ") || "—"}</DetailField>
        <DetailField label="Last sign-in">{formatDate(lastSignIn)}</DetailField>
        <DetailField label="Analytics">
          {user.analyticsDisabled ? "Excluded" : "Included"}
        </DetailField>

        {user.members.length > 0 ? (
          <DetailField label="Organizations">
            {user.members
              .map((member) => `${member.organization.name} (${member.role})`)
              .join(", ")}
          </DetailField>
        ) : null}

        {user._count.ownedCourses > 0 ? (
          <DetailField label="Private courses">{user._count.ownedCourses}</DetailField>
        ) : null}
      </DetailFields>
    </AdminSection>
  );
}
