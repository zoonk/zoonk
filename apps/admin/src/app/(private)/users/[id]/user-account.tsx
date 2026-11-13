import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { StateMark } from "@/components/state-mark";
import { getUser } from "@/data/users/get-user";
import { formatDate, toWords } from "@/lib/format";
import {
  AtSignIcon,
  BookLockIcon,
  Building2Icon,
  ChartNoAxesColumnIcon,
  KeyRoundIcon,
  LogInIcon,
  MailIcon,
} from "lucide-react";

export async function UserAccount({ userId }: { userId: string }) {
  "use cache: private";

  const user = await getUser(userId);

  if (!user) {
    return null;
  }

  const lastSignIn = user.sessions[0]?.updatedAt;

  const providers = user.accounts.map((account) =>
    account.providerId === "credential" ? "Email and password" : toWords(account.providerId),
  );

  return (
    <AdminSection title="Sign-in">
      <DetailFields>
        <DetailField icon={<MailIcon aria-hidden="true" />} label="Email">
          {user.email}
          {user.emailVerified ? null : (
            <>
              {" "}
              <StateMark state="unverified" tone="attention">
                Not verified
              </StateMark>
            </>
          )}
        </DetailField>
        <DetailField icon={<AtSignIcon aria-hidden="true" />} label="Username">
          {user.username ? `@${user.username}` : "—"}
        </DetailField>
        <DetailField icon={<KeyRoundIcon aria-hidden="true" />} label="Signs in with">
          {providers.join(", ") || "—"}
        </DetailField>
        <DetailField icon={<LogInIcon aria-hidden="true" />} label="Last sign-in">
          {formatDate(lastSignIn)}
        </DetailField>
        <DetailField icon={<ChartNoAxesColumnIcon aria-hidden="true" />} label="Analytics">
          {user.analyticsDisabled ? (
            <StateMark state="excluded" tone="off">
              Excluded
            </StateMark>
          ) : (
            "Included"
          )}
        </DetailField>

        {user.members.length > 0 ? (
          <DetailField icon={<Building2Icon aria-hidden="true" />} label="Organizations">
            {user.members
              .map((member) => `${member.organization.name} (${member.role})`)
              .join(", ")}
          </DetailField>
        ) : null}

        {user._count.ownedCourses > 0 ? (
          <DetailField icon={<BookLockIcon aria-hidden="true" />} label="Private courses">
            {user._count.ownedCourses}
          </DetailField>
        ) : null}
      </DetailFields>
    </AdminSection>
  );
}
