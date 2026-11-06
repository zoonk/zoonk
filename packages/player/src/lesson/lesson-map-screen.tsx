"use client";

import { NetworkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerReadScene } from "../components/player-read-scene";
import { LessonMap } from "./_components/lesson-map";
import { SCREEN_CHIP_CLASS } from "./_components/lesson-step-text";
import { LessonActionBar } from "./lesson-action-bar";
import { useLessonPlayerConfig } from "./lesson-player-context";
import { LessonScreenFrame } from "./lesson-stage";

export function LessonMapScreen() {
  const t = useExtracted();
  const { lesson } = useLessonPlayerConfig();

  if (!lesson.summary) {
    return null;
  }

  return (
    <>
      <div className="flex flex-1 flex-col" data-slot="lesson-map-screen">
        <LessonScreenFrame turn={null}>
          <PlayerReadScene className="gap-5">
            <h2 className={SCREEN_CHIP_CLASS}>
              <NetworkIcon aria-hidden="true" />
              {t({
                description:
                  "A small diagram of this lesson's main ideas, drawn by the app. Not the chapter's mind map.",
                message: "Lesson map",
              })}
            </h2>
            <LessonMap map={lesson.summary} title={lesson.title} />
          </PlayerReadScene>
        </LessonScreenFrame>
      </div>
      <LessonActionBar />
    </>
  );
}
