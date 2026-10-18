import { AdminJson } from "@/components/admin-json";
import { ProvenanceLine } from "@/components/provenance";
import { VoteTotalsLabel } from "@/components/vote-totals";
import { type VoteTotals, readVoteTotals } from "@/data/feedback/get-vote-totals";
import { type LibraryLessonStep } from "@/data/lessons/get-library-lesson";
import { formatPercent } from "@/lib/format";
import { Badge } from "@zoonk/ui/components/badge";
import { isJsonObject } from "@zoonk/utils/json";
import Link from "next/link";

export type StepAnswers = { correct: number; total: number };

const PERCENT = 100;

/** Activity screens name their template (slider graph, chart reader...) in the content. */
function getActivityTemplate(step: LibraryLessonStep): string | null {
  const template = isJsonObject(step.content) ? step.content.template : null;
  return step.kind === "activity" && typeof template === "string" ? template : null;
}

function AnswersLabel({ answers }: { answers?: StepAnswers }) {
  if (!answers || answers.total === 0) {
    return <span className="text-muted-foreground">No answers</span>;
  }

  return (
    <span>
      {answers.total} answers · {formatPercent((answers.correct / answers.total) * PERCENT)} right
    </span>
  );
}

/** Links to the Library rows a screen points at, when it has them. */
function StepLinks({ step }: { step: LibraryLessonStep }) {
  return (
    <span className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
      {step.skill ? (
        <Link className="underline" href={`/skills/${step.skill.id}`}>
          Skill: {step.skill.name}
        </Link>
      ) : null}
      {step.item ? (
        <Link className="underline" href={`/items/${step.item.id}`}>
          Item ({step.item.format})
        </Link>
      ) : null}
      {step.mediaAsset ? (
        <Link className="underline" href={`/media/${step.mediaAsset.id}`}>
          {step.mediaAsset.kind}
        </Link>
      ) : null}
      {step._count.answerExplanations > 0 ? (
        <span>{step._count.answerExplanations} answer explanations</span>
      ) : null}
      {step._count.exampleLines > 0 ? <span>{step._count.exampleLines} example lines</span> : null}
      {step._count.mistakes > 0 ? <span>{step._count.mistakes} mistakes</span> : null}
    </span>
  );
}

/** One screen: its kind and contract version, who wrote it, answers, votes and its versions. */
export function LessonScreen({
  answers,
  step,
  stepVotes,
  variantVotes,
}: {
  answers?: StepAnswers;
  step: LibraryLessonStep;
  stepVotes: Map<string, VoteTotals>;
  variantVotes: Map<string, VoteTotals>;
}) {
  const template = getActivityTemplate(step);

  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="text-muted-foreground tabular-nums">{step.position + 1}.</span>
            {step.kind}
            {template ? <Badge variant="outline">{template}</Badge> : null}
            <span className="text-muted-foreground text-xs">v{step.contractVersion}</span>
          </span>
          <StepLinks step={step} />
        </div>

        <div className="flex items-start gap-4 text-xs">
          <AnswersLabel answers={answers} />
          <VoteTotalsLabel totals={readVoteTotals(stepVotes, step.id)} />
          <ProvenanceLine provenance={step} />
        </div>
      </div>

      <AdminJson label="Content" value={step.content} />

      {step.variants.length > 0 ? (
        <ul className="border-muted ml-4 flex flex-col gap-2 border-l pl-4">
          {step.variants.map((variant) => (
            <li className="flex flex-col gap-1" key={variant.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="font-medium">
                  {variant.kind}
                  {variant.key ? `: ${variant.key}` : ""}
                  <span className="text-muted-foreground"> · v{variant.contractVersion}</span>
                </span>
                <span className="flex items-center gap-4">
                  <VoteTotalsLabel totals={readVoteTotals(variantVotes, variant.id)} />
                  <ProvenanceLine provenance={variant} />
                </span>
              </div>
              <AdminJson label="Version content" value={variant.content} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
