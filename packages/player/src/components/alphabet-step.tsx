"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { useExtracted } from "next-intl";
import { PlayerReadScene, PlayerReadSceneStack } from "./player-read-scene";

type AlphabetContent = ReturnType<typeof getAlphabetContent>;
type AlphabetForm = AlphabetContent["forms"][number];

/**
 * Parses alphabet content at the component boundary so the renderer can pass a
 * normal serialized step while this component keeps a precise content shape.
 */
function getAlphabetContent(step: SerializedStep) {
  return parseStepContent("alphabet", step.content);
}

/**
 * Renders the target symbol large enough for shape recognition, including
 * right-to-left or complex-script glyphs via automatic text direction.
 */
function AlphabetSymbol({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-7xl leading-none font-semibold sm:text-8xl" dir="auto">
      {children}
    </p>
  );
}

/**
 * Keeps the reading cues grouped under the symbol so learners connect the
 * native shape, Latin reading aid, and pronunciation hint.
 */
function AlphabetReading({
  pronunciation,
  readingAid,
}: {
  pronunciation: string;
  readingAid: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-foreground text-xl font-medium sm:text-2xl">{readingAid}</p>
      <p className="text-muted-foreground text-sm">{pronunciation}</p>
    </div>
  );
}

/**
 * Provides shape variants for scripts where the same symbol changes by
 * position or joining context, such as Arabic-family scripts.
 */
function AlphabetForms({ forms }: { forms: AlphabetForm[] }) {
  if (forms.length === 0) {
    return null;
  }

  return (
    <dl className="grid w-full grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-4">
      {forms.map((form) => (
        <div className="flex min-w-0 flex-col gap-1" key={`${form.label}-${form.symbol}`}>
          <dt className="text-muted-foreground text-xs">{form.label}</dt>
          <dd className="text-2xl font-medium" dir="auto">
            {form.symbol}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Renders the dedicated writing-system card for non-Roman alphabet lessons.
 * The layout emphasizes recognition first, then pronunciation and script forms.
 */
export function AlphabetStep({ step }: { step: SerializedStep }) {
  const t = useExtracted();
  const content = getAlphabetContent(step);

  return (
    <PlayerReadScene className="w-full">
      <div
        aria-label={`${t("Alphabet")}: ${content.symbol}`}
        className="flex w-full flex-col gap-6"
        role="region"
      >
        <PlayerReadSceneStack className="gap-3">
          <AlphabetSymbol>{content.symbol}</AlphabetSymbol>
          <AlphabetReading pronunciation={content.pronunciation} readingAid={content.readingAid} />
        </PlayerReadSceneStack>

        <AlphabetForms forms={content.forms} />
      </div>
    </PlayerReadScene>
  );
}
