import { type readLatestWrittenMocks } from "../../learner/facts/written-mocks";
import { type WrittenSample } from "../../learner/facts/written-samples";
import { mockWrittenStanding } from "../mocks/mock-written-points";
import { getCalibratedWritingGrade } from "../scoring/calibrated-written-standing";
import { type WrittenProjection } from "../scoring/written-points-contract";

export function withMockStanding({
  mocks,
  parts,
  samples,
}: {
  mocks: Awaited<ReturnType<typeof readLatestWrittenMocks>>;
  parts: WrittenProjection["parts"];
  samples: readonly WrittenSample[];
}) {
  if (mocks.length === 0) {
    return parts;
  }

  const byMock = Map.groupBy(samples, (sample) => sample.mockExamId);

  return parts.map((part) => {
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

    const grades = new Map(
      (byMock.get(latest.id) ?? []).flatMap(({ answer, itemId, prompt }) => {
        const grade = getCalibratedWritingGrade({
          basis: prompt,
          grade: answer.grade,
          observed: answer.grader,
        });

        return grade ? [[itemId, grade] as const] : [];
      }),
    );

    return {
      ...part,
      standing: mockWrittenStanding({
        grades,
        part: { ...latest.part, max: part.max, minimum: part.minimum },
      }),
    };
  });
}
