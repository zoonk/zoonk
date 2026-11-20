import { AdminJson } from "@/components/admin-json";
import { ScreenWords, screenKindLabel } from "@/components/screen-words";
import { type LibraryLessonStep } from "@/data/lessons/get-library-lesson";
import { formatCount, formatPercent, toWords } from "@/lib/format";
import { LINK_CLASS } from "@/lib/link-class";
import Link from "next/link";

export type StepAnswers = { correct: number; total: number };

const PERCENT = 100;

function answersLabel(answers?: StepAnswers): string | null {
  if (!answers) {
    return null;
  }

  return answers.total === 0
    ? "No answers yet"
    : `${formatCount(answers.total, "answer")} · ${formatPercent((answers.correct / answers.total) * PERCENT)} right`;
}

function ScreenLinks({ step }: { step: LibraryLessonStep }) {
  if (!(step.item || step.mediaAsset)) {
    return null;
  }

  return (
    <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {step.item ? (
        <Link className={LINK_CLASS} href={`/items/${step.item.id}`}>
          Practice question
        </Link>
      ) : null}
      {step.mediaAsset ? (
        <Link className={LINK_CLASS} href={`/media/${step.mediaAsset.id}`}>
          {toWords(step.mediaAsset.kind)}
        </Link>
      ) : null}
    </p>
  );
}

function ScreenJson({ step }: { step: LibraryLessonStep }) {
  return (
    <div className="flex flex-col">
      <AdminJson open value={step.content} />
      {step.variants.map((variant) => (
        <AdminJson
          key={variant.id}
          label={`Version: ${toWords(variant.kind)}${variant.key ? `, ${variant.key}` : ""}`}
          value={variant.content}
        />
      ))}
    </div>
  );
}

export function LessonScreen({
  answers,
  json,
  step,
  translation,
}: {
  answers?: StepAnswers;
  /** Shows what is stored under the words, for a screen whose words don't say everything. */
  json: boolean;
  step: LibraryLessonStep;
  /** The lesson's translation of the screen's word. */
  translation?: string;
}) {
  return (
    <li className="grid grid-cols-[3ch_minmax(0,1fr)] gap-x-2 py-5 first:pt-0">
      <span className="text-muted-foreground font-mono text-xs leading-5 tabular-nums">
        {step.position + 1}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-muted-foreground text-xs leading-5 font-medium">
            {screenKindLabel(step)}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs">{answersLabel(answers)}</span>
        </div>

        <div className="flex max-w-prose flex-col gap-3 text-sm leading-6">
          <ScreenWords
            content={step.content}
            kind={step.kind}
            sentence={step.sentence?.sentence}
            translation={translation}
            word={step.word?.word}
          />
        </div>

        <ScreenLinks step={step} />

        {json ? <ScreenJson step={step} /> : null}
      </div>
    </li>
  );
}
