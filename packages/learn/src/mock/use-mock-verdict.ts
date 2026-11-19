import { type MockResult, type MockVerdict } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";
import { reachedEveryMinimum } from "./mock-result-points";

/** One sentence on what the number means for the learner's next days, or nothing. */
export function useMockVerdict({
  result,
  verdict,
}: {
  result: MockResult;
  verdict: MockVerdict | null;
}): string | null {
  const t = useExtracted();
  const best = verdict?.strongest;
  const worst = verdict?.weakest;

  if (reachedEveryMinimum(result.points)) {
    return t("You reached every minimum in this mock exam.");
  }

  if (best && worst) {
    return t("Strongest: {best}. Work on: {worst}.", { best, worst });
  }

  if (best) {
    return t({
      description:
        "Under a mock exam's score when only its best subject is named: the words of the first half of “Strongest: {best}. Work on: {worst}.”",
      message: "Strongest: {best}.",
      values: { best },
    });
  }

  return worst
    ? t({
        description:
          "Under a mock exam's score when only the subject to work on is named: the words of the second half of “Strongest: {best}. Work on: {worst}.”",
        message: "Work on: {worst}.",
        values: { worst },
      })
    : null;
}
