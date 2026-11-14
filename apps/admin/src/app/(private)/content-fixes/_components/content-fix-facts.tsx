import { AdminDisclosure } from "@/components/admin-json";
import { DetailField, DetailFields } from "@/components/detail-field";
import { capitalize, formatDateTime } from "@/lib/format";
import { getEnvironment } from "@zoonk/utils/environment";
import { MAIN_URL } from "@zoonk/utils/url";

/** Who proposed a fix, when and from where: a batch says it from its first fix. */
export function proposedFact(fix: {
  createdAt: Date;
  proposer: { name: string } | null;
  proposerClientId: string | null;
}): string {
  const proposedIn = fix.proposerClientId === "admin" ? "Admin" : "the CLI";
  const proposer = fix.proposer?.name ?? "a deleted account";

  return `Proposed ${formatDateTime(fix.createdAt)} by ${proposer} in ${proposedIn}`;
}

/** The ids a developer needs, closed, under the environment they belong to. */
export function ContentFixTechnicalDetails({ children }: { children: React.ReactNode }) {
  return (
    <AdminDisclosure label="Technical details">
      <div className="pb-2 text-sm">
        <DetailFields>
          <DetailField label="Environment" mono={false}>
            {capitalize(getEnvironment())} · {new URL(MAIN_URL).host}
          </DetailField>
          {children}
        </DetailFields>
      </div>
    </AdminDisclosure>
  );
}
