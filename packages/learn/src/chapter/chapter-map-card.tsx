"use client";

import { type MapSkill } from "@zoonk/core/view-models/map/contract";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { MapLegend } from "../map/map-legend";
import { SkillDetail } from "../map/skill-detail";
import { SkillMap } from "../map/skill-map";
import { useChapterScreen, useLessonHref } from "./chapter-context";

/** A tapped skill's lessons in this chapter; the ones the learner can open are links. */
function SkillLessons({ skill }: { skill: MapSkill }) {
  const t = useExtracted();
  const lessonHref = useLessonHref();
  const { chapter } = useChapterScreen();
  const lessons = chapter.lessons.filter((lesson) => lesson.skillIds.includes(skill.skillId));

  if (lessons.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-muted-foreground text-xs font-medium">{t("Lessons")}</h4>
      <ul className="flex flex-col">
        {lessons.map((lesson) => (
          <li className="text-sm" key={lesson.lessonId}>
            {lesson.state === "upcoming" ? (
              <span className="text-muted-foreground inline-flex min-h-11 items-center">
                {lesson.title}
              </span>
            ) : (
              <LearnLink
                className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
                href={lessonHref(lesson.lessonId)}
              >
                {lesson.title}
              </LearnLink>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The chapter's map: its skills linked by what each needs, with their mastery. Tapping a skill
 * shows its idea and the lessons that teach it.
 */
export function ChapterMapCard() {
  const t = useExtracted();
  const { chapter } = useChapterScreen();

  return (
    <section
      aria-labelledby="chapter-map-title"
      className="bg-card ring-foreground/10 in-data-[mode=fun]:fun-glass flex flex-col gap-4 rounded-3xl p-4 ring-1 in-data-[mode=fun]:ring-0"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold" id="chapter-map-title">
          {t("Map")}
        </h2>
        <MapLegend />
      </div>

      {chapter.skills.length > 0 ? (
        <SkillMap
          label={t("Skills in {chapter}", { chapter: chapter.chapter.title })}
          renderDetail={(skill) => (
            <SkillDetail skill={skill}>
              <SkillLessons skill={skill} />
            </SkillDetail>
          )}
          rootTitle={chapter.chapter.title}
          skills={chapter.skills}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("The map fills in as this chapter's lessons are written.")}
        </p>
      )}
    </section>
  );
}
