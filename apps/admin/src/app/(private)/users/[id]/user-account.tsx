import { getUser } from "@/data/users/get-user";
import { Separator } from "@zoonk/ui/components/separator";
import { DetailField } from "./detail-field";

export async function UserAccount({ userId }: { userId: string }) {
  const user = await getUser(userId);

  if (!user) {
    return null;
  }

  const lastLogin = user.sessions[0]?.updatedAt;
  const providers = user.accounts.map((a) => a.providerId);

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Account</h3>
      <Separator />

      <dl className="mt-2">
        <DetailField label="Email">{user.email}</DetailField>
        <DetailField label="Email verified">{user.emailVerified ? "Yes" : "No"}</DetailField>

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
      </dl>
    </section>
  );
}
