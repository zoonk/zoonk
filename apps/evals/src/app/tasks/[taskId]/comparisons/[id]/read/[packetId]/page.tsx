import { EvalPageTop, EvalPageTopSkeleton } from "@/components/eval-page-top";
import { Fold } from "@/components/fold";
import { PROSE_MEASURE_CLASS } from "@/lib/table-classes";
import { ContainerBody, ContainerDescription } from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MainActionBar } from "../../../_components/main-action-link";
import { nextOwnerPacket, ownerPackets, packetCase } from "../../../_utils/case-evidence";
import { getComparisonRoute } from "../../../_utils/comparison-route";
import { comparisonPath, readPath } from "../../../_utils/paths";
import { comparisonTitle } from "../../../_utils/titles";
import { failureAdvice } from "../../../_utils/words";
import { BlindReadForm } from "./blind-read-form";
import { Reveal } from "./reveal";

type ReadParams = PageProps<"/tasks/[taskId]/comparisons/[id]/read/[packetId]">["params"];

export const metadata: Metadata = { title: "Read blind" };

async function getRead(params: ReadParams) {
  const { id, packetId, taskId } = await params;
  const route = await getComparisonRoute(taskId, id);
  const owner = ownerPackets(route.comparison);
  const index = owner.findIndex((entry) => entry.packet.id === packetId);
  const entry = owner[index];

  if (!entry) {
    notFound();
  }

  const attempts = route.comparison.attempts
    .filter((attempt) => attempt.packetId === packetId)
    .toSorted((left, right) => left.attempt.localeCompare(right.attempt));

  return {
    ...route,
    failed: attempts.findLast((attempt) => !attempt.passed) ?? null,
    packet: entry.packet,
    passed: attempts.find((attempt) => attempt.passed) ?? null,
    position: { index, total: owner.length },
  };
}

function LastFailure({ failures }: { failures: string[] }) {
  return (
    <p className="text-destructive-text text-sm" role="status">
      Your last read of these pairs didn’t count:{" "}
      {failures.map((failure) => failureAdvice(failure)).join("; ")}. Read them again.
    </p>
  );
}

async function ReadContent({ params }: { params: ReadParams }) {
  const read = await getRead(params);
  const { comparison, id, packet, passed, position, taskId } = read;
  const step = `Case ${position.index + 1} of ${position.total}`;

  if (passed) {
    const next = nextOwnerPacket(comparison);

    return (
      <>
        <EvalPageTop
          parent={{ href: comparisonPath(taskId, id), label: comparisonTitle(comparison.manifest) }}
          title={`Your read of ${packetCase(packet)}`}
        >
          <ContainerDescription>{step}</ContainerDescription>
        </EvalPageTop>

        <ContainerBody className="sm:flex-1">
          <div className="flex flex-1 flex-col">
            <Reveal attempt={passed} comparison={comparison} packet={packet} />
          </div>

          {next ? (
            <MainActionBar href={readPath({ id, packetId: next.id, taskId })}>
              Next case
            </MainActionBar>
          ) : (
            <MainActionBar href={comparisonPath(taskId, id)}>See the comparison</MainActionBar>
          )}
        </ContainerBody>
      </>
    );
  }

  return (
    <>
      <EvalPageTop
        parent={{ href: comparisonPath(taskId, id), label: "Comparison" }}
        title="Read blind"
      >
        <ContainerDescription className={PROSE_MEASURE_CLASS}>
          {step}. {packet.packet.reads}: say which answer serves them better. Two pairs are checks:
          one shows the same answer twice, and one has a planted mistake to add as a major problem.
        </ContainerDescription>
      </EvalPageTop>

      <ContainerBody className="sm:flex-1">
        {read.failed && <LastFailure failures={read.failed.failures} />}
        <Fold title="What each point means">
          <dl className="flex max-w-3xl flex-col gap-3 pb-2 text-sm">
            {packet.packet.criteria.map((criterion) => (
              <div className="flex flex-col gap-0.5" key={criterion.id}>
                <dt className="font-medium">{criterion.label}</dt>
                <dd className="text-muted-foreground">{criterion.expectations}</dd>
              </div>
            ))}
          </dl>
        </Fold>
        <BlindReadForm
          comparisonId={id}
          packet={packet.packet}
          packetId={packet.id}
          taskId={taskId}
        />
      </ContainerBody>
    </>
  );
}

export default function ReadPage({ params }: { params: ReadParams }) {
  return (
    <main className="flex min-h-dvh flex-col gap-4">
      <Suspense fallback={<EvalPageTopSkeleton />}>
        <ReadContent params={params} />
      </Suspense>
    </main>
  );
}
