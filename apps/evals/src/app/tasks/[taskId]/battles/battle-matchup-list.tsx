"use client";

import { FoldRowTitle } from "@/components/fold-row-title";
import { getModelById, getModelDisplayName } from "@/lib/models";
import { type BattleMatchup, type CategoryScore } from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@zoonk/ui/components/accordion";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import Link from "next/link";
import { RankingItem } from "./ranking-item";

type TestCaseEntry = {
  testCaseId: string;
  score: number;
  reasoning: string;
  anonymousId: string;
  categoryScores?: CategoryScore[];
};

export function BattleMatchupListSkeleton() {
  return (
    <div aria-hidden="true" className="py-8">
      <Skeleton className="h-6 w-48 rounded" />
    </div>
  );
}

function buildJudgeViews(
  matchups: BattleMatchup[],
): {
  judgeId: string;
  judgeName: string;
  models: {
    modelId: string;
    modelName: string;
    averageScore: number;
    testCases: TestCaseEntry[];
  }[];
}[] {
  const judgeMap = new Map<string, Map<string, TestCaseEntry[]>>();
  const judgeNames = new Map<string, string>();

  for (const matchup of matchups) {
    for (const judgment of matchup.judgments) {
      if (!judgeNames.has(judgment.judgeId)) {
        const judgeModel = getModelById(judgment.judgeId);

        judgeNames.set(
          judgment.judgeId,
          judgeModel ? getModelDisplayName(judgeModel) : judgment.judgeId,
        );
      }

      const modelMap = judgeMap.get(judgment.judgeId) ?? new Map<string, TestCaseEntry[]>();
      judgeMap.set(judgment.judgeId, modelMap);

      for (const ranking of judgment.rankings) {
        const entries = modelMap.get(ranking.modelId) ?? [];

        entries.push({
          anonymousId: ranking.anonymousId,
          categoryScores: ranking.categoryScores,
          reasoning: ranking.reasoning,
          score: ranking.score,
          testCaseId: matchup.testCaseId,
        });

        modelMap.set(ranking.modelId, entries);
      }
    }
  }

  return [...judgeMap.entries()].map(([judgeId, modelMap]) => ({
    judgeId,
    judgeName: judgeNames.get(judgeId) ?? judgeId,
    models: [...modelMap.entries()]
      .map(([modelId, testCases]) => {
        const model = getModelById(modelId);
        const totalScore = testCases.reduce((sum, tc) => sum + tc.score, 0);

        return {
          averageScore: testCases.length > 0 ? totalScore / testCases.length : 0,
          modelId,
          modelName: model ? getModelDisplayName(model) : modelId,
          testCases,
        };
      })
      .toSorted((a, b) => b.averageScore - a.averageScore),
  }));
}

function ModelItem({
  model,
}: {
  model: { modelId: string; modelName: string; averageScore: number; testCases: TestCaseEntry[] };
}) {
  return (
    <AccordionItem value={model.modelId}>
      <AccordionTrigger className="hover:no-underline">
        <FoldRowTitle title={model.modelName}>
          <span className="text-muted-foreground font-sans text-xs font-normal">
            {model.testCases.length} {model.testCases.length === 1 ? "case" : "cases"}
          </span>{" "}
          <span className="ms-2 font-semibold">{model.averageScore.toFixed(1)}</span>
        </FoldRowTitle>
      </AccordionTrigger>

      <AccordionContent className="flex flex-col gap-3 pt-4">
        {model.testCases.map((tc) => (
          <RankingItem
            anonymousId={tc.anonymousId}
            categoryScores={tc.categoryScores}
            key={tc.testCaseId}
            reasoning={tc.reasoning}
            score={tc.score}
            testCaseId={tc.testCaseId}
          />
        ))}
      </AccordionContent>
    </AccordionItem>
  );
}

export function BattleMatchupList({
  matchups,
  taskId,
}: {
  matchups: BattleMatchup[];
  taskId: string;
}) {
  if (matchups.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-sm">
        No battles yet.{" "}
        <Link className="text-foreground underline underline-offset-4" href={`/tasks/${taskId}`}>
          Run a battle from the task
        </Link>
        .
      </p>
    );
  }

  const judgeViews = buildJudgeViews(matchups);

  return (
    <div className="flex flex-col gap-10">
      {judgeViews.map((judge) => (
        <section key={judge.judgeId}>
          <h2 className="mb-2 text-lg font-semibold">Judged by {judge.judgeName}</h2>

          <Accordion>
            {judge.models.map((model) => (
              <ModelItem key={model.modelId} model={model} />
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  );
}
