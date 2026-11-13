"use client";

import { getScoreClassName } from "@/lib/score";
import { calculateScore } from "@/lib/score-calculation";
import { PROSE_MEASURE_CLASS } from "@/lib/table-classes";
import {
  type CategoryScore,
  type EvalResult,
  type FailedRun,
  type KeyFlaw,
  type ScoreStep,
  type TestCaseOutput,
} from "@/lib/types";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@zoonk/ui/components/accordion";
import { Button } from "@zoonk/ui/components/button";
import { SwapLabel } from "@zoonk/ui/components/swap-label";
import { useClipboard } from "@zoonk/ui/hooks/clipboard";
import { cn } from "@zoonk/ui/lib/utils";
import { Check, Copy } from "lucide-react";

const COPY_LABELS = ["Copy", "Copied"];

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value.join(", ");
  }

  return JSON.stringify(value, null, 2);
}

function UserInputSection({ userInput }: { userInput: Record<string, unknown> }) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">Input</p>

      <div className="flex flex-col gap-1">
        {Object.entries(userInput).map(([key, value]) => {
          const formatted = formatValue(value);
          const isMultiline = formatted.includes("\n");

          return (
            <div className={cn("text-sm font-medium", PROSE_MEASURE_CLASS)} key={key}>
              <span className="text-muted-foreground">{key}:</span>{" "}
              {isMultiline ? (
                <pre className="bg-muted mt-1 overflow-auto rounded p-2 text-xs">{formatted}</pre>
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

function TokensSection({
  inputTokens,
  outputTokens,
}: {
  inputTokens: number;
  outputTokens: number;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="text-muted-foreground text-sm">Input tokens</p>
        <p className="font-medium">{inputTokens}</p>
      </div>

      <div>
        <p className="text-muted-foreground text-sm">Output tokens</p>
        <p className="font-medium">{outputTokens}</p>
      </div>
    </div>
  );
}

function OutputSection({ output }: { output: string }) {
  const { isCopied, copy } = useClipboard();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Output</p>
        <Button
          edge="end"
          icon={isCopied ? <Check /> : <Copy />}
          onClick={() => copy(output)}
          size="sm"
          variant="ghost"
        >
          <SwapLabel current={isCopied ? "Copied" : "Copy"} labels={COPY_LABELS} />
        </Button>
      </div>

      <pre className="bg-muted overflow-x-auto rounded-xl p-4 text-sm">{output}</pre>
    </div>
  );
}

function EvaluationStepsSection({ steps }: { steps: ScoreStep[] }) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-sm">Evaluation steps</p>
      <div className="flex flex-col gap-2">
        {steps.map((step) => (
          <div className="rounded-xl border p-3" key={step.kind}>
            <p className="mb-1 text-sm font-medium capitalize">{step.kind.replaceAll("_", " ")}</p>
            <p className="text-muted-foreground text-sm">{step.conclusion}</p>
            <p className="text-muted-foreground mt-1 text-sm">Score: {step.score}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryScoresSection({ categoryScores }: { categoryScores: CategoryScore[] }) {
  if (categoryScores.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-muted-foreground mb-2 text-sm">Category scores</p>
      <div className="grid gap-2 md:grid-cols-2">
        {categoryScores.map((category) => (
          <div className="rounded-xl border p-3" key={category.categoryId}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{category.label}</p>
              <p className="text-sm font-medium">{category.score.toFixed(1)}</p>
            </div>
            <p className="text-muted-foreground text-sm">{category.reasoning}</p>
            <p className="text-muted-foreground mt-1 text-xs">Weight: {category.weight}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The score ends on the row's edge in mono, so scores line up down the list. */
function TestCaseTitle({ children, title }: React.PropsWithChildren<{ title: string }>) {
  return (
    <span className="flex min-w-0 flex-1 items-baseline justify-between gap-6">
      <span className="min-w-0 wrap-break-word">{title}</span>
      <span className="text-compact shrink-0 font-mono">{children}</span>
    </span>
  );
}

export function TestCase({ result, index }: { result: EvalResult; index: number }) {
  const testCaseTitle = result.testCase.id || `Test Case ${index + 1}`;
  const score = calculateScore({ categoryScores: result.categoryScores, steps: result.steps });
  const scoreDisplay = score.toFixed(2);

  return (
    <AccordionItem id={`case-${result.testCase.id}`} value={`test-case-${index}`}>
      <AccordionTrigger className="hover:no-underline">
        <TestCaseTitle title={testCaseTitle}>
          <span className={getScoreClassName(score)}>{scoreDisplay}</span>
        </TestCaseTitle>
      </AccordionTrigger>

      <AccordionContent className="flex flex-col gap-4 pt-4">
        <UserInputSection userInput={result.testCase.userInput} />

        <TokensSection inputTokens={result.inputTokens} outputTokens={result.outputTokens} />

        <OutputSection output={result.output} />

        <CategoryScoresSection categoryScores={result.categoryScores ?? []} />

        <KeyFlawsSection flaws={result.keyFlaws} />

        <EvaluationStepsSection steps={result.steps} />
      </AccordionContent>
    </AccordionItem>
  );
}

export function OutputTestCase({ output, index }: { output: TestCaseOutput; index: number }) {
  const testCaseTitle = output.testCase.id || `Test Case ${index + 1}`;

  return (
    <AccordionItem id={`case-${output.testCaseId}`} value={`output-test-case-${index}`}>
      <AccordionTrigger className="hover:no-underline">
        <TestCaseTitle title={testCaseTitle}>
          <span className="text-muted-foreground font-sans">Not scored</span>
        </TestCaseTitle>
      </AccordionTrigger>

      <AccordionContent className="flex flex-col gap-4 pt-4">
        <UserInputSection userInput={output.testCase.userInput} />

        <TokensSection inputTokens={output.inputTokens} outputTokens={output.outputTokens} />

        <OutputSection output={output.output} />
      </AccordionContent>
    </AccordionItem>
  );
}

function KeyFlawsSection({ flaws }: { flaws?: KeyFlaw[] }) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-sm">
        Judge-flagged key flaws: {flaws === undefined ? "not recorded" : flaws.length}
      </p>
      {flaws?.map((flaw) => (
        <div className="mb-2 rounded-xl border p-3 text-sm" key={flaw.itemLocator}>
          <p className="font-medium">
            {flaw.itemLocator}: {flaw.kind}
          </p>
          <p>Keyed answer: {flaw.keyedAnswer}</p>
          <p>Judge&apos;s worked answer: {flaw.workedAnswer}</p>
        </div>
      ))}
    </div>
  );
}

export function FailedTestCase({
  anchored,
  caseId,
  runs,
}: {
  anchored: boolean;
  caseId: string;
  runs: FailedRun[];
}) {
  return (
    <section
      className="rounded-xl border p-4 wrap-anywhere"
      id={anchored ? `case-${caseId}` : undefined}
    >
      <h3 className="font-medium">
        {caseId}: Generation failed ({runs.length} {runs.length === 1 ? "attempt" : "attempts"})
      </h3>
      <ul className="mt-2 space-y-2 text-sm">
        {runs.map((run, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- Repeated failures have no distinct saved ID.
          <li key={index}>
            {run.reason ?? "unknown"}: {run.message ?? "Message not recorded"}
          </li>
        ))}
      </ul>
    </section>
  );
}
