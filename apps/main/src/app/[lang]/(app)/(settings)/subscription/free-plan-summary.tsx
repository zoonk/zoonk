import { type Allowance } from "@zoonk/core/entitlements/contract";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
} from "@zoonk/learn/list";
import { PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { getExtracted } from "next-intl/server";

/** The counts in a sentence, in the mono face as every count reads. */
function renderCount(chunks: React.ReactNode) {
  return <span className="font-mono tabular-nums">{chunks}</span>;
}

/** A free learner sees their own plan and actual message allowance before the Plus offer. */
export async function FreePlanSummary({ allowance }: { allowance: Allowance }) {
  const t = await getExtracted();
  const messages = allowance.items.find((item) => item.kind === "tutorMessage");

  return (
    <PageSection aria-labelledby="your-plan">
      <PageSectionHeader>
        <PageSectionTitle id="your-plan">{t("Your plan")}</PageSectionTitle>
      </PageSectionHeader>
      <ListGroup>
        <ListRow>
          <ListRowContent>
            <ListRowTitle>{t("Free")}</ListRowTitle>
            {messages?.dailyLimit !== null && messages?.dailyLimit !== undefined && (
              <ListRowDescription>
                {t.rich("<mono>{used, number}/{limit, number}</mono> buddy messages used today", {
                  limit: messages.dailyLimit,
                  mono: renderCount,
                  used: messages.usedToday,
                })}
              </ListRowDescription>
            )}
          </ListRowContent>
        </ListRow>
      </ListGroup>
    </PageSection>
  );
}
