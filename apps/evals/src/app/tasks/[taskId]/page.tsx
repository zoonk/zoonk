import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zoonk/ui/components/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EVAL_MODELS, getModelDisplayName } from "@/lib/models";
import { TASKS } from "@/tasks";

interface TaskPageProps {
  params: Promise<{ taskId: string }>;
}

export default async function TaskPage({ params }: TaskPageProps) {
  const { taskId } = await params;
  const task = TASKS.find((t) => t.id === taskId);

  if (!task) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl">{task.name}</h1>
        <p className="mt-2 text-muted-foreground">{task.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Model</CardTitle>
          <CardDescription>
            Choose a model to run evaluations on {task.testCases.length} test
            cases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {EVAL_MODELS.map((model) => {
              const encodedModelId = encodeURIComponent(model.id);
              const href = `/tasks/${taskId}/${encodedModelId}`;
              return (
                <Link
                  key={model.id}
                  // biome-ignore lint/suspicious/noExplicitAny: next.js typed routes issue
                  href={href as any}
                >
                  <Card className="h-full transition-colors hover:bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-base">
                        {getModelDisplayName(model)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm">
                        ${model.inputCost}/M input tokens
                      </p>
                      <p className="text-muted-foreground text-sm">
                        ${model.outputCost}/M output tokens
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
