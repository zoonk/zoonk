"use client";

import { getModelById, getModelDisplayName } from "@/lib/models";
import { type BattleMatchup } from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@zoonk/ui/components/accordion";
import { Badge } from "@zoonk/ui/components/badge";
import { RankingItem } from "./ranking-item";

type TestCaseEntry = {
  testCaseId: string;
  score: number;
  reasoning: string;
  anonymousId: string;
};

/**
 * Some judges output bare anonymous letters (e.g. "C") as modelId
 * instead of the real model ID. Build a letter→modelId mapping
 * from judges that have correct data in the same matchup.
 */
function buildAnonymousIdMap(matchup: BattleMatchup): Map<string, string> {
  const mapping = new Map<string, string>();

  for (const judgment of matchup.judgments) {
    for (const ranking of judgment.rankings) {
      if (getModelById(ranking.modelId)) {
        const letter = ranking.anonymousId.replace("Model ", "");
        mapping.set(letter, ranking.modelId);
      }
    }
  }

  return mapping;
}

function resolveModelId(modelId: string, anonymousIdMap: Map<string, string>): string {
  if (getModelById(modelId)) {return modelId;}
  return anonymousIdMap.get(modelId) ?? modelId;
}

function buildJudgeViews(matchups: BattleMatchup[]): {
  judgeId: string;
  judgeName: string;
  models: {
    modelId: string;
    modelName: string;
    totalScore: number;
    averageScore: number;
    testCases: TestCaseEntry[];
  }[];
}[] {
  const judgeMap = new Map<string, Map<string, TestCaseEntry[]>>();
  const judgeNames = new Map<string, string>();

  for (const matchup of matchups) {
    const anonymousIdMap = buildAnonymousIdMap(matchup);

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
        const modelId = resolveModelId(ranking.modelId, anonymousIdMap);
        const entries = modelMap.get(modelId) ?? [];
        entries.push({
          anonymousId: ranking.anonymousId,
          reasoning: ranking.reasoning,
          score: ranking.score,
          testCaseId: matchup.testCaseId,
        });
        modelMap.set(modelId, entries);
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
          totalScore,
        };
      })
      .toSorted((a, b) => b.totalScore - a.totalScore),
  }));
}

function ModelItem({
  model,
}: {
  model: {
    modelId: string;
    modelName: string;
    totalScore: number;
    averageScore: number;
    testCases: TestCaseEntry[];
  };
}) {
  return (
    <AccordionItem value={model.modelId}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3">
          <span className="font-medium">{model.modelName}</span>
          <Badge variant="secondary">{model.totalScore.toFixed(1)} pts</Badge>
          <Badge variant="outline">avg: {model.averageScore.toFixed(1)}</Badge>
        </div>
      </AccordionTrigger>

      <AccordionContent className="flex flex-col gap-3 pt-4">
        {model.testCases.map((tc) => (
          <RankingItem
            anonymousId={tc.anonymousId}
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

export function BattleMatchupList({ matchups }: { matchups: BattleMatchup[] }) {
  if (matchups.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        No battle results yet. Run Battle Mode first.
      </p>
    );
  }

  const judgeViews = buildJudgeViews(matchups);

  return (
    <div className="flex flex-col gap-10">
      {judgeViews.map((judge) => (
        <section key={judge.judgeId}>
          <h3 className="mb-4 text-lg font-semibold">{judge.judgeName}</h3>

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
