"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ClockIcon, TargetIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerReadScene } from "../../../components/player-read-scene";
import { LessonRichText } from "../../_components/lesson-rich-text";
import { LessonEyebrow, LessonQuestion } from "../../_components/lesson-step-text";
import { type StepOf } from "../lesson-step-view-props";
import { ChallengeAvatar, ChallengeLabel, ChallengePanelView } from "./challenge-parts";
import { type ChallengeNames } from "./use-challenge-names";

type ChallengeContent = StepOf<"challenge">["content"];

function ChallengeTeamList({
  content,
  names,
}: {
  content: ChallengeContent;
  names: ChallengeNames;
}) {
  const t = useExtracted();

  return (
    <section aria-labelledby="challenge-team" className="flex w-full flex-col gap-3">
      <ChallengeLabel as="h3" id="challenge-team">
        {t("Your team")}
      </ChallengeLabel>

      <ul className="flex flex-wrap gap-x-6 gap-y-3" data-slot="challenge-team">
        {content.team.map((slot) => {
          const name = names.names[slot.id] ?? slot.role;

          return (
            <li className="flex items-center gap-2.5" key={slot.id}>
              <ChallengeAvatar name={name} slot={slot} />
              <span className="flex flex-col">
                <span className="text-foreground text-sm font-semibold">{name}</span>
                {!slot.ai && (
                  <span className="text-muted-foreground text-xs">{names.fill(slot.role)}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The case before it starts: where and when, the question, the mission with its deadline, the
 * numbers to start from and the team, with a word that asking for help is part of it.
 */
export function ChallengeIntro({
  content,
  names,
}: {
  content: ChallengeContent;
  names: ChallengeNames;
}) {
  const t = useExtracted();
  const { fill } = names;
  const hasAi = content.team.some((slot) => slot.ai);

  return (
    <PlayerReadScene className="gap-5 sm:gap-6">
      <div className="flex flex-col gap-3">
        <LessonEyebrow
          className="bg-warning/10 text-warning"
          icon={<TargetIcon aria-hidden="true" />}
        >
          {content.variant === "whatIf"
            ? t("What if · {setting}", { setting: fill(content.setting) })
            : t("Challenge · {setting}", { setting: fill(content.setting) })}
        </LessonEyebrow>
        <LessonQuestion>{fill(content.title)}</LessonQuestion>
      </div>

      <section
        aria-labelledby="challenge-mission"
        className="border-border flex w-full flex-col gap-2 rounded-2xl border p-4 shadow-xs"
        data-slot="challenge-mission"
      >
        <ChallengeLabel as="h3" id="challenge-mission">
          {t("Your mission")}
        </ChallengeLabel>
        <p className="text-foreground text-lg leading-relaxed">
          <LessonRichText text={fill(content.mission)} />
        </p>
        {content.deadline && (
          <p className="text-muted-foreground flex items-start gap-2 text-sm">
            <LineMarker>
              <ClockIcon aria-hidden="true" className="size-4" />
            </LineMarker>
            {fill(content.deadline)}
          </p>
        )}
      </section>

      {content.panels.map((panel, index) => {
        const key = `panel-${index}`;
        return <ChallengePanelView fill={fill} key={key} panel={panel} />;
      })}

      <ChallengeTeamList content={content} names={names} />

      <p className="text-muted-foreground text-sm">
        {hasAi
          ? t("You can ask the team or the AI for help. Your decisions change the outcome.")
          : t("You can ask the team for help. Your decisions change the outcome.")}
      </p>
    </PlayerReadScene>
  );
}
