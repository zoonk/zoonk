import { EvalPageTop, EvalPageTopSkeleton } from "@/components/eval-page-top";
import { canAdjudicate } from "@/lib/comparisons/evidence";
import { formatDollars, formatSeconds } from "@/lib/format";
import { PROSE_MEASURE_CLASS } from "@/lib/table-classes";
import { ContainerBody, ContainerDescription } from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import { MainActionBar } from "../_components/main-action-link";
import { nextOwnerPacket, ownerReads } from "../_utils/case-evidence";
import { type ComparisonRoute, getComparisonRoute } from "../_utils/comparison-route";
import { readPath } from "../_utils/paths";
import { comparisonTitle, outcomeText } from "../_utils/titles";
import { plural } from "../_utils/words";
import { CasesSection } from "./cases-section";
import { DecisionTable } from "./decision-table";
import { PrioritiesSection } from "./priorities-section";
import { ReadersSection } from "./readers-section";

type ComparisonParams = PageProps<"/tasks/[taskId]/comparisons/[id]">["params"];

async function getRoute(params: ComparisonParams) {
  const { id, taskId } = await params;
  return getComparisonRoute(taskId, id);
}

export async function generateMetadata({
  params,
}: {
  params: ComparisonParams;
}): Promise<Metadata> {
  const { comparison } = await getRoute(params);
  return { title: comparisonTitle(comparison.manifest) };
}

function ownerProgress(route: ComparisonRoute) {
  const reads = ownerReads(route.comparison);

  return {
    cases: reads.length,
    done: reads.filter((entry) => entry.read).length,
    unread: reads.filter((entry) => !entry.read).map((entry) => entry.caseId),
  };
}

function OwnerStatus({ route }: { route: ComparisonRoute }) {
  const progress = ownerProgress(route);

  const needCall = route.decision.cases.filter((item) =>
    canAdjudicate(route.comparison.manifest, item),
  );

  if (progress.cases === 0) {
    return <p className="text-sm">This comparison has no blind read for you.</p>;
  }

  return (
    <>
      <p className="text-sm">
        You’ve read {progress.done} of {plural(progress.cases, "case")} blind.
      </p>
      {needCall.length > 0 && (
        <p className="text-sm">
          Readers disagree on{" "}
          {needCall.map((item, index) => (
            <span key={item.caseId}>
              {index > 0 && ", "}
              <a
                className="font-mono text-xs underline underline-offset-4"
                href={`#case-${item.caseId}`}
              >
                {item.caseId}
              </a>
            </span>
          ))}
          , so your blind read settles {needCall.length === 1 ? "it" : "them"}. You can also rule on{" "}
          {needCall.length === 1 ? "it" : "each"} with the model names shown; the later of the two
          counts.
        </p>
      )}
    </>
  );
}

function AuditDelivery({ route }: { route: ComparisonRoute }) {
  const row = route.decision.rows.find((entry) => entry.side === "challenger");

  if (!row) {
    return null;
  }

  return (
    <p className="text-muted-foreground font-mono text-xs">
      {formatDollars(row.costPer1000)} per 1,000 · wait {formatSeconds(row.p50)} typical,{" "}
      {formatSeconds(row.p95)} slowest · {row.succeeded} of {row.attempted} delivered
    </p>
  );
}

function OutcomeSection({ route }: { route: ComparisonRoute }) {
  const { comparison, decision } = route;
  const audit = !comparison.manifest.variants.incumbent;

  return (
    <section className={`flex flex-col gap-2 ${PROSE_MEASURE_CLASS}`}>
      <p className="text-xl font-semibold tracking-tight">{outcomeText(comparison, decision)}</p>
      <p className="text-muted-foreground text-sm">
        {audit
          ? "Readers read this output on its own and listed the problems they saw."
          : decision.reason}
      </p>
      {audit && <AuditDelivery route={route} />}
      <OwnerStatus route={route} />
    </section>
  );
}

async function ComparisonHeader({ params }: { params: ComparisonParams }) {
  const { comparison, task, taskId } = await getRoute(params);
  const { manifest } = comparison;

  return (
    <EvalPageTop
      parent={{ href: `/tasks/${taskId}`, label: task.name }}
      title={comparisonTitle(manifest)}
    >
      {manifest.variants.incumbent && (
        <ContainerDescription className={PROSE_MEASURE_CLASS}>
          {manifest.question}
        </ContainerDescription>
      )}
    </EvalPageTop>
  );
}

async function ComparisonBody({ params }: { params: ComparisonParams }) {
  const route = await getRoute(params);
  const { comparison, decision, id, taskId } = route;
  const audit = !comparison.manifest.variants.incumbent;
  const progress = ownerProgress(route);

  const firstCall = decision.cases.find((item) => item.result === "unresolved" && !item.owner);
  const next = nextOwnerPacket(comparison, firstCall?.caseId);

  return (
    <ContainerBody className="gap-10">
      <OutcomeSection route={route} />
      {!audit && <DecisionTable decision={decision} manifest={comparison.manifest} />}
      <PrioritiesSection manifest={comparison.manifest} />
      <CasesSection comparison={comparison} decision={decision} unread={progress.unread} />
      <ReadersSection comparison={comparison} decision={decision} />

      {next && (
        <MainActionBar href={readPath({ id, packetId: next.id, taskId })}>Read blind</MainActionBar>
      )}
    </ContainerBody>
  );
}

export default function ComparisonPage({ params }: { params: ComparisonParams }) {
  return (
    <main className="flex min-h-dvh flex-col gap-4">
      <Suspense fallback={<EvalPageTopSkeleton />}>
        <ComparisonHeader params={params} />
        <ComparisonBody params={params} />
      </Suspense>
    </main>
  );
}
