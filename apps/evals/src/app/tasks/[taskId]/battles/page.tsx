import { EvalPageTop, EvalPageTopSkeleton } from "@/components/eval-page-top";
import { getBattleMatchups } from "@/lib/battle-loader";
import { PROSE_MEASURE_CLASS } from "@/lib/table-classes";
import { supportsJudgeMode } from "@/lib/types";
import { ContainerBody, ContainerDescription } from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import { type TaskRouteParams, getTaskRouteFromParams } from "../_utils/task-route";
import { BattleMatchupList } from "./battle-matchup-list";

type BattlesRouteProps = { params: TaskRouteParams };

export async function generateMetadata({ params }: BattlesRouteProps): Promise<Metadata> {
  const { task } = await getTaskRouteFromParams(params);

  return { title: `Judge comments on ${task.name}` };
}

async function BattlesHeader({ params }: BattlesRouteProps) {
  const { task, taskId } = await getTaskRouteFromParams(params);

  return (
    <EvalPageTop parent={{ href: `/tasks/${taskId}`, label: task.name }} title="Judge comments">
      <ContainerDescription className={PROSE_MEASURE_CLASS}>
        {supportsJudgeMode(task)
          ? "Each judge's average score for a model, out of 10, and what it wrote about every test case. A judge never scores its own model family."
          : "This task isn't judged side by side: each output is scored on its own, against its test case."}
      </ContainerDescription>
    </EvalPageTop>
  );
}

async function BattleResults({ params }: BattlesRouteProps) {
  const { task, taskId } = await getTaskRouteFromParams(params);

  if (!supportsJudgeMode(task)) {
    return null;
  }

  const matchups = await getBattleMatchups(taskId);

  return <BattleMatchupList matchups={matchups} taskId={taskId} />;
}

export default function BattlesPage({ params }: BattlesRouteProps) {
  return (
    <main className="flex flex-col gap-4">
      {/* One boundary: the title and the list arrive together, so the list never moves down. */}
      <Suspense fallback={<EvalPageTopSkeleton />}>
        <BattlesHeader params={params} />

        <ContainerBody>
          <BattleResults params={params} />
        </ContainerBody>
      </Suspense>
    </main>
  );
}
