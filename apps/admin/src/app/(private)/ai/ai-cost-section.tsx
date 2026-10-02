import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { AI_COST_PERIOD_DAYS, getAiGenerationCosts } from "@/data/ai/get-ai-generation-costs";
import { Alert, AlertDescription, AlertTitle } from "@zoonk/ui/components/alert";
import { AiCostTable } from "./ai-cost-table";

const SECTION_TITLE = "Cost and latency";
const SECTION_DESCRIPTION = `Model calls by task and model over the last ${AI_COST_PERIOD_DAYS} days, from PostHog's $ai_generation events.`;

function NotConfigured() {
  return (
    <AdminSectionEmpty>
      Set <code className="font-mono text-xs">POSTHOG_PERSONAL_API_KEY</code> (with Query Read
      access) and <code className="font-mono text-xs">POSTHOG_PROJECT_ID</code> to read AI costs
      from PostHog. <code className="font-mono text-xs">POSTHOG_API_HOST</code> is optional and
      defaults to https://us.posthog.com.
    </AdminSectionEmpty>
  );
}

/** PostHog is optional and external: a missing key or an outage shows here instead of failing the page. */
export async function AiCostSection() {
  const result = await getAiGenerationCosts();

  return (
    <AdminSection description={SECTION_DESCRIPTION} title={SECTION_TITLE}>
      {result.status === "notConfigured" ? <NotConfigured /> : null}

      {result.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load AI costs</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : null}

      {result.status === "ok" && result.rows.length === 0 ? (
        <AdminSectionEmpty>
          No model calls in the last {AI_COST_PERIOD_DAYS} days.
        </AdminSectionEmpty>
      ) : null}

      {result.status === "ok" && result.rows.length > 0 ? <AiCostTable rows={result.rows} /> : null}
    </AdminSection>
  );
}
