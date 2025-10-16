// biome-ignore-all lint/suspicious/noArrayIndexKey: we don't have stable IDs

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@zoonk/ui/components/card";
import { getModelById } from "@/lib/models";
import type { TaskEvalResults } from "@/lib/types";

const DECIMAL_PLACES = 4;

interface EvalResultsProps {
  results: TaskEvalResults;
}

export function EvalResults({ results }: EvalResultsProps) {
  const model = getModelById(results.modelId);

  if (!model) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-sm">Average Score</p>
              <p className="font-bold text-2xl">
                {results.averageScore.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Avg Input Tokens</p>
              <p className="font-bold text-2xl">
                {Math.round(results.averageInputTokens)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Avg Output Tokens</p>
              <p className="font-bold text-2xl">
                {Math.round(results.averageOutputTokens)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Cost (100 runs)</p>
              <p className="font-bold text-2xl">
                ${results.totalCost.toFixed(DECIMAL_PLACES)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 font-semibold text-xl">Test Cases</h2>
        <div className="space-y-4">
          {results.results.map((result, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-base">
                  Test Case {index + 1}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-sm">User Input</p>
                    <div className="space-y-1">
                      {result.testCase.userInput ? (
                        Object.entries(result.testCase.userInput).map(
                          ([key, value]) => (
                            <p key={key} className="font-medium text-sm">
                              <span className="text-muted-foreground">
                                {key}:
                              </span>{" "}
                              {value}
                            </p>
                          ),
                        )
                      ) : (
                        <p className="font-medium text-muted-foreground text-sm">
                          Legacy test case format - delete eval results and
                          re-run
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Score</p>
                    <p className="font-medium">{result.score.toFixed(2)}</p>
                  </div>
                </div>{" "}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Input Tokens
                    </p>
                    <p className="font-medium">{result.inputTokens}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Output Tokens
                    </p>
                    <p className="font-medium">{result.outputTokens}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-muted-foreground text-sm">Output</p>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    {result.output}
                  </pre>
                </div>
                <div>
                  <p className="mb-2 text-muted-foreground text-sm">
                    Evaluation Steps
                  </p>
                  <div className="space-y-2">
                    {result.steps.map((step, stepIndex) => (
                      <div key={stepIndex} className="rounded-lg border p-3">
                        <p className="mb-1 font-medium text-sm capitalize">
                          {step.kind.replace(/_/g, " ")}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {step.conclusion}
                        </p>
                        <p className="mt-1 text-muted-foreground text-sm">
                          Score: {step.score}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
