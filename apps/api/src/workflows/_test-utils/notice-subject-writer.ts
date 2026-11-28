import {
  generateSkillGraphFrame,
  generateSkillGraphSection,
} from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { vi } from "vitest";
import { taskResult } from "./recorded-outputs";

export function mockNoticeSubjectWriter({
  area,
  courseTitle,
  lessonCount,
  skillName,
  topicIds,
}: {
  area: string;
  courseTitle: string;
  lessonCount: number;
  skillName: string;
  topicIds: string[];
}) {
  const subject = topicIds[0]?.split(".")[0] ?? "";
  const { data: _, ...result } = taskResult(null);
  const level = "beginner";
  const key = "notice-course";

  vi.mocked(generateSkillGraphFrame).mockResolvedValue({
    ...result,
    output: {
      courses: [{ countrySpecific: false, key, levels: [level], title: courseTitle }],
      phases: [{ milestone: "Apply the tested ideas", title: "Foundations" }],
      sections: [
        { area, course: key, estimatedLessons: lessonCount, phases: [1], skills: 1, subject },
      ],
    },
  });

  vi.mocked(generateSkillGraphSection).mockImplementation(async ({ part }) => {
    const section = part.sections.find((item) => item.subject === subject);

    return {
      ...result,
      output: {
        skills: section
          ? [
              {
                area,
                course: section.course,
                description: skillName,
                estimatedLessons: lessonCount,
                examWeight: 3,
                extra: false,
                key: "new-skill",
                level,
                name: skillName,
                outcome: false,
                phase: 1,
                prerequisites: [],
                topics: topicIds,
              },
            ]
          : [],
      },
    };
  });
}
