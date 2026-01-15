import { Badge } from "@zoonk/ui/components/badge";
import { BreadcrumbSeparator } from "@zoonk/ui/components/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zoonk/ui/components/card";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { notFound } from "next/navigation";
import {
  AppBreadcrumb,
  BattleDetailPageBreadcrumb,
  BattlesLinkBreadcrumb,
  HomeLinkBreadcrumb,
  TaskLinkBreadcrumb,
} from "@/components/breadcrumb";
import { getBattleMatchup } from "@/lib/battle-loader";
import { getModelById, getModelDisplayName } from "@/lib/models";
import { getTaskById } from "@/tasks";

type BattleDetailPageProps = {
  params: Promise<{ taskId: string; testCaseId: string }>;
};

export default async function BattleDetailPage({
  params,
}: BattleDetailPageProps) {
  const { taskId, testCaseId } = await params;
  const task = getTaskById(taskId);

  if (!task) {
    notFound();
  }

  const matchup = await getBattleMatchup(taskId, testCaseId);

  if (!matchup) {
    notFound();
  }

  // Get all unique models from the matchup
  const modelIds = new Set<string>();
  for (const judgment of matchup.judgments) {
    for (const ranking of judgment.rankings) {
      modelIds.add(ranking.modelId);
    }
  }

  // Build a map of model rankings by model ID
  const modelRankings = new Map<
    string,
    Array<{
      judgeId: string;
      judgeName: string;
      score: number;
      reasoning: string;
      anonymousId: string;
    }>
  >();

  for (const modelId of modelIds) {
    modelRankings.set(modelId, []);
  }

  for (const judgment of matchup.judgments) {
    const judgeModel = getModelById(judgment.judgeId);
    const judgeName = judgeModel
      ? getModelDisplayName(judgeModel)
      : judgment.judgeId;

    for (const ranking of judgment.rankings) {
      const rankings = modelRankings.get(ranking.modelId);
      if (rankings) {
        rankings.push({
          anonymousId: ranking.anonymousId,
          judgeId: judgment.judgeId,
          judgeName,
          reasoning: ranking.reasoning,
          score: ranking.score,
        });
      }
    }
  }

  // Sort models by total score
  const sortedModels = [...modelIds].sort((a, b) => {
    const aTotal =
      modelRankings.get(a)?.reduce((sum, r) => sum + r.score, 0) ?? 0;
    const bTotal =
      modelRankings.get(b)?.reduce((sum, r) => sum + r.score, 0) ?? 0;
    return bTotal - aTotal;
  });

  return (
    <main className="flex flex-col gap-4">
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbSeparator />
        <TaskLinkBreadcrumb taskId={taskId} taskName={task.name} />
        <BreadcrumbSeparator />
        <BattlesLinkBreadcrumb taskId={taskId} />
        <BreadcrumbSeparator />
        <BattleDetailPageBreadcrumb testCaseId={testCaseId} />
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>Battle: {testCaseId}</ContainerTitle>
          <ContainerDescription>
            Judged at {new Date(matchup.judgedAt).toLocaleString()}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <div className="flex flex-col gap-6">
          {sortedModels.map((modelId) => {
            const model = getModelById(modelId);
            const modelName = model ? getModelDisplayName(model) : modelId;
            const rankings = modelRankings.get(modelId) ?? [];
            const totalScore = rankings.reduce((sum, r) => sum + r.score, 0);

            return (
              <Card key={modelId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{modelName}</CardTitle>
                      <CardDescription>{modelId}</CardDescription>
                    </div>
                    <Badge className="text-lg" variant="secondary">
                      {totalScore.toFixed(1)} pts
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  {rankings.map((ranking) => (
                    <div
                      className="rounded-lg border border-border p-4"
                      key={ranking.judgeId}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {ranking.judgeName}
                          </span>
                          <Badge variant="outline">{ranking.anonymousId}</Badge>
                        </div>
                        <Badge>{ranking.score.toFixed(1)}</Badge>
                      </div>
                      <p className="whitespace-pre-wrap text-muted-foreground text-sm">
                        {ranking.reasoning}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <details className="mt-8">
          <summary className="cursor-pointer text-muted-foreground text-sm hover:underline">
            View test case expectations
          </summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-muted p-4 text-xs">
            {matchup.expectations}
          </pre>
        </details>
      </ContainerBody>
    </main>
  );
}
