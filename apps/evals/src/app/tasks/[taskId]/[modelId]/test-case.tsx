import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@zoonk/ui/components/accordion";
import { calculateScore, getScoreClassName } from "@/lib/score";
import type { EvalResult, ScoreStep } from "@/lib/types";

interface TestCaseCardProps {
  result: EvalResult;
  index: number;
}

interface UserInputSectionProps {
  userInput: Record<string, string>;
}

interface ScoreSectionProps {
  score: number;
}

interface TokensSectionProps {
  inputTokens: number;
  outputTokens: number;
}

interface OutputSectionProps {
  output: string;
}

interface EvaluationStepsSectionProps {
  steps: ScoreStep[];
}

function UserInputSection({ userInput }: UserInputSectionProps) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">User Input</p>

      <div className="flex flex-col gap-1">
        {Object.entries(userInput).map(([key, value]) => (
          <p key={key} className="font-medium text-sm">
            <span className="text-muted-foreground">{key}:</span> {value}
          </p>
        ))}
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
  return (
    <div>
      <p className="mb-2 text-muted-foreground text-sm">Output</p>

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
          <div key={step.kind} className="rounded-lg border p-3">
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
