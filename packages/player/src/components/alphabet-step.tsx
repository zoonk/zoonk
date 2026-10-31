"use client";

import { parseStepContent } from "@zoonk/core/library/steps/contract";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { useExtracted } from "next-intl";
import { PlayerReadScene, PlayerReadSceneStack } from "./player-read-scene";

type AlphabetContent = ReturnType<typeof getAlphabetContent>;
type AlphabetForm = AlphabetContent["forms"][number];

function getAlphabetContent(step: SerializedStep) {
  return parseStepContent("alphabet", step.content);
}

function AlphabetSymbol({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[4rem] leading-none font-semibold" dir="auto">
      {children}
    </p>
  );
}

function AlphabetReading({
  pronunciation,
  readingAid,
}: {
  pronunciation: string;
  readingAid: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-foreground text-xl font-medium">{readingAid}</p>
      <p className="text-muted-foreground text-sm">{pronunciation}</p>
    </div>
  );
}

function AlphabetForms({ forms }: { forms: AlphabetForm[] }) {
  if (forms.length === 0) {
    return null;
  }

  return (
    <dl className="border-border grid w-full grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-4">
      {forms.map((form) => (
        <div className="flex min-w-0 flex-col gap-1" key={`${form.label}-${form.symbol}`}>
          <dt className="text-muted-foreground text-xs font-medium">{form.label}</dt>
          <dd className="text-2xl font-medium" dir="auto">
            {form.symbol}
          </dd>
        </div>
      ))}
    </dl>
  );
}

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
