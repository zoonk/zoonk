import { AdminTechnicalDetails } from "@/components/admin-json";
import { DetailField, DetailFields } from "@/components/detail-field";
import { capitalize, formatDateTime } from "@/lib/format";
import { getEnvironment } from "@zoonk/utils/environment";
import { MAIN_URL } from "@zoonk/utils/url";

/** Who proposed a fix, when and from where: a batch says it from its first fix. */
export function proposalFacts(fix: {
  createdAt: Date;
  proposer: { name: string } | null;
  proposerClientId: string | null;
}) {
  const proposedIn = fix.proposerClientId === "admin" ? "Admin" : "the CLI";
  const proposer = fix.proposer?.name ?? "a deleted account";

  return [
    {
      content: <span className="whitespace-nowrap">Proposed {formatDateTime(fix.createdAt)}</span>,
      key: "proposed-date",
    },
    {
      content: (
        <>
          By {proposer} <span className="whitespace-nowrap">in {proposedIn}</span>
        </>
      ),
      key: "proposer",
    },
  ];
}

/** The ids a developer needs, closed, under the environment they belong to. */
export function ContentFixTechnicalDetails({ children }: { children: React.ReactNode }) {
  return (
    <AdminTechnicalDetails>
      <div className="pb-2 text-sm">
        <DetailFields>
          <DetailField label="Environment" mono={false}>
            {capitalize(getEnvironment())} · {new URL(MAIN_URL).host}
          </DetailField>
          {children}
        </DetailFields>
      </div>
    </AdminTechnicalDetails>
  );
}
