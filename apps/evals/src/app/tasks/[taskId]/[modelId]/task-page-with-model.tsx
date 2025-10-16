import { Button } from "@zoonk/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zoonk/ui/components/card";
import { PlayIcon } from "lucide-react";
import Link from "next/link";
import { getTaskResults } from "@/lib/eval-runner";
import { getModelById } from "@/lib/models";
import { runEvalAction } from "../actions";
import { EvalResults } from "../eval-results";

interface TaskPageWithModelProps {
  taskId: string;
  taskName: string;
  modelId: string;
}

export async function TaskPageWithModel({
  taskId,
  taskName,
  modelId,
}: TaskPageWithModelProps) {
  const model = getModelById(modelId);
  const results = await getTaskResults(taskId, modelId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl">{taskName}</h1>
        <p className="mt-2 text-muted-foreground">
          Run evals and view results for this task
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run Eval</CardTitle>
          <CardDescription>
            Evaluating with {model?.name || modelId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async () => {
              "use server";
              await runEvalAction(taskId, modelId);
            }}
          >
            <div className="flex items-center gap-4">
              <Button type="submit" className="w-full sm:w-auto">
                <PlayIcon className="size-4" />
                Run Eval
              </Button>
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
    </div>
  );
}
