import { type readLatestWrittenMocks } from "../../learner/facts/written-mocks";
import { type WrittenSample } from "../../learner/facts/written-samples";
import { type listWrittenTasks } from "../../library/exams/written-tasks";
import { answersWritingTask } from "../essays/_utils/writing-task-basis";
import { mockWrittenStanding } from "../mocks/mock-written-points";
import { getCalibratedWritingGrade } from "../scoring/calibrated-written-standing";
import { writtenStanding } from "../scoring/written-points";
import { type WrittenProjection } from "../scoring/written-points-contract";

export function withMockStanding({
  mocks,
  parts,
  samples,
  tasks,
}: {
  mocks: Awaited<ReturnType<typeof readLatestWrittenMocks>>;
  parts: WrittenProjection["parts"];
  samples: readonly WrittenSample[];
  tasks: ReturnType<typeof listWrittenTasks>;
}) {
  if (mocks.length === 0) {
    return parts;
  }

  const byMock = Map.groupBy(samples, (sample) => sample.mockExamId);

  return parts.map((part): WrittenProjection["parts"][number] => {
    const latest = mocks.find((mock) => mock.part.name === part.name);

    if (
      !latest ||
      part.scale === "levels" ||
      part.tasks.length !== latest.part.tasks.length ||
      !part.tasks.every((task) =>
        latest.part.tasks.some((saved) => task.key === saved.key && task.max === saved.max),
      )
    ) {
      return part;
    }

    // An answer marked by rules its task no longer has leaves the mock unjudged, as it leaves
    // the estimate, so the part keeps its own verdict.
    const grades = new Map(
      (byMock.get(latest.id) ?? []).flatMap(({ answer, itemId, prompt }) => {
        if (!tasks.some((task) => answersWritingTask({ prompt, task }))) {
          return [];
        }

        const grade = getCalibratedWritingGrade({
          basis: prompt,
          grade: answer.grade,
          observed: answer.grader,
        });

        return grade ? [[itemId, grade] as const] : [];
      }),
    );

    const sitting = mockWrittenStanding({
      grades,
      part: { ...latest.part, max: part.max, minimum: part.minimum },
    });

    // A mock graded before points could be measured can't be judged; the practice verdict stands.
    if (sitting === "unmeasured") {
      return part;
    }

    // The estimate beside this verdict averages practice answers too, so the two can disagree.
    const practice = writtenStanding(part);

    const contradicted =
      (sitting === "met" && practice === "below") || (sitting === "below" && practice === "met");

    return { ...part, standing: contradicted ? "unmeasured" : sitting };
  });
}
