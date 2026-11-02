import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { getUser } from "@/data/users/get-user";
import { formatDate } from "@/lib/format";
import { Avatar, AvatarImage } from "@zoonk/ui/components/avatar";
import { Button } from "@zoonk/ui/components/button";
import { updateUserAnalyticsDisabledAction } from "./_actions/update-user-analytics-disabled";

export async function UserAccount({ userId }: { userId: string }) {
  "use cache: private";

  const user = await getUser(userId);

  if (!user) {
    return null;
  }

  const lastLogin = user.sessions[0]?.updatedAt;
  const providers = user.accounts.map((a) => a.providerId);

  return (
    <AdminSection
      action={<AnalyticsTrackingForm analyticsDisabled={user.analyticsDisabled} userId={user.id} />}
      title="Account"
    >
      <DetailFields>
        {user.image && (
          <DetailField label="Photo">
            <Avatar>
              <AvatarImage alt={user.name} src={user.image} />
            </Avatar>
          </DetailField>
        )}
        <DetailField label="Email">{user.email}</DetailField>
        <DetailField label="Email verified">{user.emailVerified ? "Yes" : "No"}</DetailField>
        <DetailField label="Analytics">
          {user.analyticsDisabled ? "Excluded" : "Included"}
        </DetailField>

        {user.banned && (
          <DetailField label="Ban">
            {user.banExpires ? `Until ${formatDate(user.banExpires)}` : "No end date"}
            {user.banReason && (
              <span className="text-muted-foreground block">{user.banReason}</span>
            )}
          </DetailField>
        )}

        <DetailField label="Auth providers">
          {providers.length > 0 ? <span className="capitalize">{providers.join(", ")}</span> : "—"}
        </DetailField>

        <DetailField label="Joined">{new Date(user.createdAt).toLocaleDateString()}</DetailField>
        <DetailField label="Last updated">
          {new Date(user.updatedAt).toLocaleDateString()}
        </DetailField>

        <DetailField label="Last login">
          {lastLogin ? new Date(lastLogin).toLocaleDateString() : "—"}
        </DetailField>
      </DetailFields>
    </AdminSection>
  );
}

function AnalyticsTrackingForm({
  analyticsDisabled,
  userId,
}: {
  analyticsDisabled: boolean;
  userId: string;
}) {
  const nextValue = !analyticsDisabled;

  return (
    <form action={updateUserAnalyticsDisabledAction}>
      <input name="userId" type="hidden" value={userId} />
      <input name="analyticsDisabled" type="hidden" value={String(nextValue)} />
      <Button size="sm" type="submit" variant="outline">
        {analyticsDisabled ? "Include in analytics" : "Exclude from analytics"}
      </Button>
    </form>
  );
}
