import { BreadcrumbSeparator } from "@zoonk/ui/components/breadcrumb";
import { Button } from "@zoonk/ui/components/button";
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
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { PlayIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AppBreadcrumb,
  HomeLinkBreadcrumb,
  ModelPageBreadcrumb,
  TaskLinkBreadcrumb,
} from "@/components/breadcrumb";
import { ModelStatusBadge } from "@/components/model-status-badge";
import { getTaskResults } from "@/lib/eval-runner";
import { EVAL_MODELS, getModelDisplayName } from "@/lib/models";
import { TASKS } from "@/tasks";
import { runEvalAction } from "./actions";
import { EvalResults } from "./eval-results";

export default async function TaskModelPage({
  params,
}: PageProps<"/tasks/[taskId]/[modelId]">) {
  const { taskId, modelId: rawModelId } = await params;
  const task = TASKS.find((t) => t.id === taskId);

  if (!task) {
    notFound();
  }

  const modelId = decodeURIComponent(rawModelId);
  const model = EVAL_MODELS.find((m) => m.id === modelId);

  if (!model) {
    redirect(`/tasks/${taskId}`);
  }

  const results = await getTaskResults(taskId, modelId);

  return (
    <main className="flex flex-col gap-4">
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbSeparator />
        <TaskLinkBreadcrumb taskId={task.id} taskName={task.name} />
        <BreadcrumbSeparator />
        <ModelPageBreadcrumb modelName={getModelDisplayName(model)} />
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{task.name}</ContainerTitle>
          <ContainerDescription>
            Run evals and view results for this task
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Run Eval
              <ModelStatusBadge modelId={modelId} taskId={taskId} />
            </CardTitle>
            <CardDescription>
              Evaluating with {model?.name || modelId}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form action={runEvalAction}>
              <input name="taskId" type="hidden" value={taskId} />
              <input name="modelId" type="hidden" value={modelId} />

              <div className="flex items-center gap-4">
                <SubmitButton icon={<PlayIcon />}>Run Eval</SubmitButton>

                <Link href={`/tasks/${taskId}`}>
                  <Button type="button" variant="outline">
                    Change Model
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {results && <EvalResults results={results} />}
      </ContainerBody>
    </main>
  );
}
