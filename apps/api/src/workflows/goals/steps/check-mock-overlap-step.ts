import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import { checkRecallOverlap, toRecallQuestion } from "@zoonk/ai/tasks/items/check-recall-overlap";
import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { type MockWritingSkill } from "@zoonk/core/exams/mocks/prep";
import { type toContentAnalytics } from "../../_shared/content-analytics";

function normalizeQuestion(text: string) {
  const lines = text
    .normalize("NFKC")
    .toLowerCase()
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replaceAll(/\s+/gu, " ")
        .replace(/[.!?]+$/u, ""),
    );

  const sortedOptions = lines.filter((line) => line.startsWith("- ")).toSorted();

  return [...lines.filter((line) => !line.startsWith("- ")), ...sortedOptions]
    .filter(Boolean)
    .join(" ");
}

export async function checkMockOverlapStep<Item extends GeneratedItem>({
  mock,
  items,
  wait,
  analytics,
  stimulus,
}: {
  mock: MockWritingSkill;
  items: readonly Item[];
  wait: CallWait;
  analytics?: ReturnType<typeof toContentAnalytics>;
  stimulus?: string;
}): Promise<Item[]> {
  "use step";
  const previous = new Set(mock.earlier.map((question) => normalizeQuestion(question.question)));

  const candidates = items.flatMap((item) => {
    const candidate =
      stimulus && "context" in item
        ? { ...item, context: [stimulus, item.context].filter(Boolean).join("\n") }
        : item;

    const normalized = normalizeQuestion(toRecallQuestion(candidate).question);

    if (previous.has(normalized)) {
      return [];
    }

    previous.add(normalized);
    return [{ candidate, item }];
  });

  if (mock.earlier.length === 0 || candidates.length === 0) {
    return candidates.map((entry) => entry.item);
  }

  const { data } = await checkRecallOverlap({
    analytics,
    candidates: candidates.map((entry) => entry.candidate),
    earlier: mock.earlier,
    serviceTier: chooseServiceTier({ wait }),
    skill: { description: mock.description, name: mock.name },
  });

  const repeats = new Set(data.repeats.map((match) => match.candidate));
  return candidates.flatMap(({ item }, index) => (repeats.has(index) ? [] : [item]));
}
