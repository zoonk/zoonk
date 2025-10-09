"use client";

import { useState } from "react";
import type { ModelConfig } from "@/ai/evals/models";
import { getModelDisplayName } from "@/ai/evals/models";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { getAvailableModels, runEval } from "./actions";

const TWO_DECIMALS = 2;
const TITLE = "Run Evaluation";
const LABEL_SELECT_MODEL = "Select Model";
const PLACEHOLDER_CHOOSE = "Choose a model";
const BTN_RUNNING = "Running";
const BTN_RUN = "Run Eval";
const LABEL_RESULTS = "Results for";
const LABEL_AVG_SCORE = "Average Score:";
const LABEL_MEDIAN_SCORE = "Median Score:";
const LABEL_AVG_COST = "Avg. Cost per 100 calls: $";

export function EvalRunner() {
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    modelName: string;
    averageScore: number;
    medianScore: number;
    avgCostPer100: number;
  } | null>(null);
  const [models, setModels] = useState<ModelConfig[]>([]);

  const loadModels = async () => {
    const availableModels = await getAvailableModels();
    setModels(availableModels);
  };

  const handleRunEval = async () => {
    if (!selectedModel) {
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const evalResult = await runEval(selectedModel);
      setResult(evalResult);
    } catch (error) {
      console.error("Failed to run eval:", error);
    } finally {
      setIsRunning(false);
    }
  };

  // Load models on mount
  if (models.length === 0) {
    void loadModels();
  }

  return (
    <div className="rounded-lg border p-6">
      <h2 className="mb-4 font-semibold text-xl">{TITLE}</h2>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="model-select"
            className="mb-2 block font-medium text-sm"
          >
            {LABEL_SELECT_MODEL}
          </label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger id="model-select">
              <SelectValue placeholder={PLACEHOLDER_CHOOSE} />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {getModelDisplayName(model)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleRunEval} disabled={!selectedModel || isRunning}>
          {isRunning ? (
            <>
              <Spinner className="mr-2" />
              {BTN_RUNNING}
            </>
          ) : (
            BTN_RUN
          )}
        </Button>

        {result ? (
          <div className="mt-4 rounded-md bg-muted p-4">
            <p className="font-semibold">
              {LABEL_RESULTS} {result.modelName}
            </p>
            <ul className="mt-2 space-y-1">
              <li>
                {LABEL_AVG_SCORE} {result.averageScore.toFixed(TWO_DECIMALS)}
              </li>
              <li>
                {LABEL_MEDIAN_SCORE} {result.medianScore.toFixed(TWO_DECIMALS)}
              </li>
              <li>
                {LABEL_AVG_COST}
                {result.avgCostPer100.toFixed(TWO_DECIMALS)}
              </li>
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
