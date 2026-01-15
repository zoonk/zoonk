"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@zoonk/ui/components/accordion";
import { Button } from "@zoonk/ui/components/button";
import { useClipboard } from "@zoonk/ui/hooks/clipboard";
import { Check, Copy } from "lucide-react";
import { calculateScore, getScoreClassName } from "@/lib/score";
import type { EvalResult, ScoreStep } from "@/lib/types";

type TestCaseCardProps = {
  result: EvalResult;
  index: number;
};

type UserInputSectionProps = {
  userInput: Record<string, unknown>;
};

type ScoreSectionProps = {
  score: number;
};

type TokensSectionProps = {
  inputTokens: number;
  outputTokens: number;
};

type OutputSectionProps = {
  output: string;
};

type EvaluationStepsSectionProps = {
  steps: ScoreStep[];
};

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    if (typeof value[0] === "string") {
      return value.join(", ");
    }

    return JSON.stringify(value, null, 2);
  }
  return JSON.stringify(value);
}

function UserInputSection({ userInput }: UserInputSectionProps) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">User Input</p>

      <div className="flex flex-col gap-1">
        {Object.entries(userInput).map(([key, value]) => {
          const formatted = formatValue(value);
          const isMultiline = formatted.includes("\n");

          return (
            <div className="font-medium text-sm" key={key}>
              <span className="text-muted-foreground">{key}:</span>{" "}
              {isMultiline ? (
                <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                  {formatted}
                </pre>
              ) : (
                formatted
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreSection({ score }: ScoreSectionProps) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">Score</p>
      <p className="font-medium">{score.toFixed(2)}</p>
    </div>
  );
}

function TokensSection({ inputTokens, outputTokens }: TokensSectionProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="text-muted-foreground text-sm">Input Tokens</p>
        <p className="font-medium">{inputTokens}</p>
      </div>

      <div>
        <p className="text-muted-foreground text-sm">Output Tokens</p>
        <p className="font-medium">{outputTokens}</p>
      </div>
    </div>
  );
}

function OutputSection({ output }: OutputSectionProps) {
  const { isCopied, copy } = useClipboard();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Output</p>
        <Button
          className="gap-2"
          onClick={() => copy(output)}
          size="sm"
          variant="ghost"
        >
          {isCopied ? (
            <>
              <Check className="size-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-4" />
              Copy
            </>
          )}
        </Button>
      </div>

      <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
        {output}
      </pre>
    </div>
  );
}

function EvaluationStepsSection({ steps }: EvaluationStepsSectionProps) {
  return (
    <div>
      <p className="mb-2 text-muted-foreground text-sm">Evaluation Steps</p>
      <div className="flex flex-col gap-2">
        {steps.map((step) => (
          <div className="rounded-lg border p-3" key={step.kind}>
            <p className="mb-1 font-medium text-sm capitalize">
              {step.kind.replace(/_/g, " ")}
            </p>
            <p className="text-muted-foreground text-sm">{step.conclusion}</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Score: {step.score}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TestCase({ result, index }: TestCaseCardProps) {
  const testCaseTitle = result.testCase.id || `Test Case ${index + 1}`;
  const score = calculateScore(result.steps);
  const scoreDisplay = score.toFixed(2);

  return (
    <AccordionItem value={`test-case-${index}`}>
      <AccordionTrigger className="flex w-full items-center justify-between pr-4 hover:no-underline">
        <span className="font-medium text-base">
          {testCaseTitle}:{" "}
          <span className={getScoreClassName(score)}>{scoreDisplay}</span>
        </span>
      </AccordionTrigger>

      <AccordionContent className="flex flex-col gap-4 pt-4">
        <UserInputSection userInput={result.testCase.userInput} />

        <ScoreSection score={score} />

        <TokensSection
          inputTokens={result.inputTokens}
          outputTokens={result.outputTokens}
        />

        <OutputSection output={result.output} />

        <EvaluationStepsSection steps={result.steps} />
      </AccordionContent>
    </AccordionItem>
  );
}
