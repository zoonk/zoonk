"use client";

import { Eyebrow } from "@zoonk/learn/eyebrow";
import { NetworkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerReadScene } from "../components/player-read-scene";
import { LessonMap } from "./_components/lesson-map";
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
            <Eyebrow aria-level={2} icon={<NetworkIcon aria-hidden="true" />} role="heading">
              {t({
                description:
                  "A small diagram of this lesson's main ideas, drawn by the app. Not the chapter's mind map.",
                message: "Lesson map",
              })}
            </Eyebrow>
            <LessonMap map={lesson.summary} title={lesson.title} />
          </PlayerReadScene>
        </LessonScreenFrame>
      </div>
      <LessonActionBar />
    </>
  );
}
