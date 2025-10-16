"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zoonk/ui/components/card";
import { Label } from "@zoonk/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zoonk/ui/components/select";
import { PlayIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { EVAL_MODELS, getModelDisplayName } from "@/lib/models";
import type { TaskEvalResults } from "@/lib/types";
import { EvalResults } from "./eval-results";

interface TaskPageClientProps {
  taskId: string;
  taskName: string;
}

export function TaskPageClient({ taskId, taskName }: TaskPageClientProps) {
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TaskEvalResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRunEval() {
    if (!selectedModel) {
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch("/api/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, modelId: selectedModel }),
      });

      if (!response.ok) {
        throw new Error("Failed to run eval");
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run eval");
    } finally {
      setIsRunning(false);
    }
  }

  // Load existing results when model changes
  useEffect(() => {
    async function loadExistingResults() {
      if (!selectedModel) {
        return;
      }

      try {
        const response = await fetch(
          `/api/results?taskId=${taskId}&modelId=${selectedModel}`,
        );
        const data = await response.json();
        setResults(data.results || null);
      } catch (err) {
        console.error("Failed to load existing results:", err);
      }
    }

    void loadExistingResults();
  }, [selectedModel, taskId]);
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
            Select a model and run evaluations on all test cases
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger id="model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {EVAL_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {getModelDisplayName(model)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleRunEval}
            disabled={!selectedModel || isRunning}
            className="w-full sm:w-auto"
          >
            {isRunning ? (
              "Running Eval..."
            ) : (
              <>
                <PlayIcon className="size-4" />
                Run Eval
              </>
            )}
          </Button>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
      </Card>

      {results && <EvalResults results={results} />}
    </div>
  );
}
