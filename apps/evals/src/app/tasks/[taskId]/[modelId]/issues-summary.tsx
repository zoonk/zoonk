import { getScoreClassName } from "@/lib/score";
import { type EvalResult, type ScoreStep } from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@zoonk/ui/components/accordion";
import { ContainerTitle } from "@zoonk/ui/components/container";

type Issue = {
  testCaseId: string;
  conclusion: string;
  score: number;
};

const ISSUE_KINDS = ["majorErrors", "minorErrors"] as const;

const LABELS: Record<(typeof ISSUE_KINDS)[number], string> = {
  majorErrors: "Major Issues",
  minorErrors: "Minor Issues",
};

function getIssuesByKind(results: EvalResult[], kind: ScoreStep["kind"]): Issue[] {
  return results
    .flatMap((result) =>
      result.steps
        .filter((step) => step.kind === kind && step.conclusion !== "None")
        .map((step) => ({
          conclusion: step.conclusion,
          score: step.score,
          testCaseId: result.testCase.id,
        })),
    )
    .toSorted((a, b) => a.score - b.score);
}

function IssueGroup({ issues, label }: { issues: Issue[]; label: string }) {
  return (
    <AccordionItem value={label}>
      <AccordionTrigger className="hover:no-underline">
        <span className="text-sm font-medium">
          {label} ({issues.length})
        </span>
      </AccordionTrigger>

      <AccordionContent>
        {issues.length === 0 ? (
          <p className="text-muted-foreground text-sm">No {label.toLowerCase()} found.</p>
        ) : (
          <div className="flex flex-col gap-2 pt-2">
            {issues.map((issue) => (
              <div
                className="flex flex-col gap-1 border-b pb-2 last:border-b-0"
                key={`${issue.testCaseId}-${issue.conclusion}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">{issue.testCaseId}</span>
                  <span className={`text-xs font-medium ${getScoreClassName(issue.score)}`}>
                    {issue.score}
                  </span>
                </div>
                <p className="text-sm">{issue.conclusion}</p>
              </div>
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

export function IssuesSummary({ results }: { results: EvalResult[] }) {
  return (
    <div className="flex flex-col gap-4">
      <ContainerTitle>Issues Summary</ContainerTitle>

      <Accordion className="w-full">
        {ISSUE_KINDS.map((kind) => (
          <IssueGroup issues={getIssuesByKind(results, kind)} key={kind} label={LABELS[kind]} />
        ))}
      </Accordion>
    </div>
  );
}
