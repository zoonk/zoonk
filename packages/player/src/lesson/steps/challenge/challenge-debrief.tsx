"use client";

import { type ChallengeStep } from "@zoonk/core/library/challenges/graph";
import { getChallengeDebrief } from "@zoonk/core/library/challenges/run";
import { CHIP_CLASS } from "@zoonk/learn/chip";
import { PageSectionLabel } from "@zoonk/learn/page";
import { cn } from "@zoonk/ui/lib/utils";
import { formatDuration } from "@zoonk/utils/duration";
import { CheckIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { PlayerReadScene } from "../../../components/player-read-scene";
import { LessonRichText } from "../../_components/lesson-rich-text";
import { type StepOf } from "../lesson-step-view-props";
import { ChallengeLabel } from "./challenge-parts";
import { type ChallengeNames } from "./use-challenge-names";

type ChallengeContent = StepOf<"challenge">["content"];
type ChallengeDebrief = ReturnType<typeof getChallengeDebrief>;

const PRACTICE_SECONDS = 300;

function DebriefNotes({
  debrief,
  fill,
}: {
  debrief: ChallengeDebrief;
  fill: (text: string) => string;
}) {
  const t = useExtracted();

  if (debrief.good.length === 0 && debrief.improve.length === 0) {
    return null;
  }

  return (
    <div className="border-border flex w-full flex-col gap-4 rounded-xl border p-4">
      {debrief.good.length > 0 && (
        <section
          aria-labelledby="challenge-good"
          className="flex flex-col gap-2"
          data-slot="challenge-good"
        >
          <ChallengeLabel as="h3" className="text-success-text" id="challenge-good">
            {t("Nicely done")}
          </ChallengeLabel>
          <ul className="flex flex-col gap-2">
            {debrief.good.map((note) => (
              <li
                className="flex gap-2 text-base leading-relaxed"
                key={`${note.skill}-${note.text}`}
              >
                <CheckIcon aria-hidden="true" className="text-success-text mt-1 size-4 shrink-0" />
                <LessonRichText text={fill(note.text)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {debrief.improve.length > 0 && (
        <section
          aria-labelledby="challenge-improve"
          className="border-border flex flex-col gap-2 not-first:border-t not-first:pt-4"
          data-slot="challenge-improve"
        >
          <ChallengeLabel as="h3" className="text-warning-text" id="challenge-improve">
            {t("To improve")}
          </ChallengeLabel>
          <ul className="flex flex-col gap-3">
            {debrief.improve.map((note) => (
              <li
                className="flex flex-col gap-2 text-base leading-relaxed"
                key={`${note.skill}-${note.text}`}
              >
                <LessonRichText text={fill(note.text)} />
                {note.example && (
                  <q className="bg-warning/10 text-foreground rounded-xl px-3 py-2">
                    <LessonRichText text={fill(note.example)} />
                  </q>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function ChallengeDebriefView({
  content,
  names,
  steps,
}: {
  content: ChallengeContent;
  names: ChallengeNames;
  steps: ChallengeStep[];
}) {
  const t = useExtracted();
  const locale = useLocale();
  const { fill } = names;
  const debrief = getChallengeDebrief(content, steps);
  const ending = steps.at(-1)?.choice.next;
  const outcome = content.endings.find((item) => item.id === ending)?.outcome;

  return (
    <PlayerReadScene className="gap-5 sm:gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-title">
          {content.variant === "whatIf" ? t("Scenario complete") : t("Challenge complete")}
        </h2>
        {outcome && (
          <p className="text-muted-foreground text-base leading-relaxed">
            <LessonRichText text={fill(outcome)} />
          </p>
        )}
      </div>

      <DebriefNotes debrief={debrief} fill={fill} />

      <section aria-labelledby="challenge-skills" className="flex flex-col gap-2">
        <PageSectionLabel id="challenge-skills">{t("Skills practiced")}</PageSectionLabel>
        <ul className="flex flex-wrap gap-2">
          {debrief.skills.map((skill) => (
            <li
              className={cn(
                CHIP_CLASS,
                "h-auto min-h-5.5 py-1 leading-4 text-balance",
                skill.id === debrief.practice?.id &&
                  "bg-warning/10 text-warning-text ring-warning/40",
              )}
              key={skill.id}
            >
              {fill(skill.name)}
            </li>
          ))}
        </ul>
      </section>

      {debrief.practice && (
        <section
          aria-labelledby="challenge-practice"
          className="bg-muted/50 flex w-full flex-col gap-1 rounded-xl p-4"
          data-slot="challenge-practice"
        >
          <ChallengeLabel as="h3" id="challenge-practice">
            {t("Practice “{skill}” · {time}", {
              skill: fill(debrief.practice.name),
              time: formatDuration({ locale, totalSeconds: PRACTICE_SECONDS }),
            })}
          </ChallengeLabel>
          <p className="text-foreground text-base leading-relaxed">
            <LessonRichText text={fill(debrief.practice.practice)} />
          </p>
        </section>
      )}
    </PlayerReadScene>
  );
}
