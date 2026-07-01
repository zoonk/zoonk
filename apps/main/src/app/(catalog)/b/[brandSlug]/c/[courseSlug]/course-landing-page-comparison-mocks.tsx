import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, CirclePlayIcon, ClockIcon } from "lucide-react";
import Image from "next/image";
import {
  type TeachingComparisonContent,
  type TeachingComparisonItem,
} from "./course-landing-page-comparison";

/**
 * Renders the passive version as an artifact a learner would recognize: a long
 * video, a rule card, a worksheet, or a recall prompt.
 */
export function TraditionalLearningMock({
  content,
  item,
}: {
  content: TeachingComparisonContent;
  item: TeachingComparisonItem;
}) {
  return (
    <article className="bg-background flex h-full min-h-107 flex-col gap-6 rounded-md p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground font-mono text-[0.66rem] tracking-[0.2em] uppercase">
          {content.traditionalLabel}
        </p>
        <p className="text-muted-foreground text-xs">{item.traditionalMeta}</p>
      </div>

      {item.mockKind === "example" && <TraditionalVideoMock />}

      <p className="text-muted-foreground text-base leading-7 text-pretty">{item.traditional}</p>
    </article>
  );
}

/**
 * Shows the common passive course shape as a long video timeline. The tiny
 * watched segment makes the contrast visible before the learner reads the text.
 */
function TraditionalVideoMock() {
  return (
    <div className="border-border/60 bg-muted/30 grid gap-3 rounded-md border p-3">
      <div className="bg-foreground/85 flex aspect-video items-center justify-center rounded-sm text-white">
        <CirclePlayIcon aria-hidden="true" className="size-9" />
      </div>
      <div className="grid gap-2">
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div className="bg-muted-foreground/45 h-full w-[12%]" />
        </div>
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>0:19</span>
          <span className="flex items-center gap-1">
            <ClockIcon aria-hidden="true" className="size-3" />
            2:47:00
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the Zoonk side as a live-looking learning moment: tiles, a contextual
 * example, or a small quiz with the useful answer highlighted.
 */
export function ZoonkLearningMock({
  content,
  item,
}: {
  content: TeachingComparisonContent;
  item: TeachingComparisonItem;
}) {
  return (
    <article className="bg-foreground text-background flex h-full min-h-107 flex-col gap-6 rounded-md p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[0.66rem] tracking-[0.2em] text-white/55 uppercase">
          {content.zoonkLabel}
        </p>
        <p className="text-xs text-white/55">{item.zoonkMeta}</p>
      </div>

      <div className="flex flex-1 flex-col">
        <ZoonkMockBody item={item} />
      </div>
    </article>
  );
}

/**
 * Chooses the smallest visual artifact that fits the selected lesson format.
 * The content stays specific, while the shell keeps all tabs feeling related.
 */
function ZoonkMockBody({ item }: { item: TeachingComparisonItem }) {
  if (item.mockKind === "example") {
    return <ZoonkExampleMock item={item} />;
  }

  return <ZoonkChoiceMock item={item} />;
}

/**
 * The explanation mock spends the visual emphasis on the everyday example,
 * then leaves the formal terms as secondary supporting chips.
 */
function ZoonkExampleMock({ item }: { item: TeachingComparisonItem }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <ExplanationIllustrationMock />
      <ZoonkPromptText text={item.zoonk} />
    </div>
  );
}

/**
 * Mimics the clean educational illustration style used for explanation lesson
 * images: geometric shapes, limited colors, generous space, and no dense text.
 */
function ExplanationIllustrationMock() {
  return (
    <div className="relative min-h-44 flex-1 overflow-hidden rounded-md bg-white">
      <Image
        alt=""
        aria-hidden="true"
        className="object-contain p-3"
        fill
        sizes="(max-width: 768px) calc(100vw - 4rem), 45vw"
        src="/course-landing/gravity-coffee-illustration.png"
      />
    </div>
  );
}

/**
 * Scenario and transfer tabs look like small quizzes so the comparison shows
 * that Zoonk asks learners to choose from evidence, not recite a definition.
 */
function ZoonkChoiceMock({ item }: { item: TeachingComparisonItem }) {
  return (
    <div className="grid gap-5">
      <ZoonkPromptText text={item.zoonk} />
      <div className="grid gap-2">
        {item.options.map((option, index) => (
          <span
            className={cn(
              "flex items-center justify-between rounded-md px-3 py-2 text-sm",
              index === 0 ? "bg-info text-white" : "bg-white/12 text-white/70",
            )}
            key={option}
          >
            {option}
            {index === 0 && <CheckIcon aria-hidden="true" className="size-4" />}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Keeps the learner-facing prompt typography identical across every Zoonk mock.
 * The explain panel should feel like the same product surface as the quiz and
 * scenario panels, not a separate marketing block.
 */
function ZoonkPromptText({ text }: { text: string }) {
  return <p className="text-lg leading-8 text-pretty">{text}</p>;
}
