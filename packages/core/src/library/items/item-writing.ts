import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { type TextLayout } from "@zoonk/utils/text-flaws";

type ItemText = { layout: TextLayout; text: string };
type ItemTextMap = (entry: ItemText) => string;

/**
 * Every text a learner reads with an item, its answer and its feedback, each rewritten by `map`
 * with how it shows: support text, questions and explanations as blocks (lines, lists, tables of
 * data), an option, pair, step, key point or rubric criterion as one line. Blocks come first, in
 * reading order. Empty texts are never mapped; they're the format checks' to report.
 */
export function mapItemWriting(item: GeneratedItem, map: ItemTextMap): GeneratedItem {
  const as = (layout: TextLayout) => (text: string) => (text.trim() ? map({ layout, text }) : text);
  const [block, line] = [as("blocks"), as("inline")];
  const support = (text: string | null) => (text === null ? null : block(text));

  switch (item.format) {
    case "multipleChoice": {
      const [context, question] = [support(item.context), block(item.question)];
      const reasons = item.options.map((option) => block(option.reason));

      const options = item.options.map((option, index) => ({
        ...option,
        reason: reasons[index] ?? option.reason,
        text: line(option.text),
      }));

      return { ...item, context, options, question };
    }
    case "trueFalse": {
      const [context, statement] = [support(item.context), block(item.statement)];
      return { ...item, context, reason: block(item.reason), statement };
    }
    case "typed":
    case "spoken": {
      const [context, question] = [support(item.context), block(item.question)];
      const sampleAnswer = block(item.sampleAnswer);
      return { ...item, context, keyPoints: item.keyPoints.map(line), question, sampleAnswer };
    }
    case "essay": {
      const [context, question] = [support(item.context), block(item.question)];
      const sampleOutline = block(item.sampleOutline);
      const descriptions = item.rubric.map((row) => block(row.description));
      const keyPoints = item.keyPoints.map(line);

      const rubric = item.rubric.map((row, index) => ({
        ...row,
        criterion: line(row.criterion),
        description: descriptions[index] ?? row.description,
      }));

      return { ...item, context, keyPoints, question, rubric, sampleOutline };
    }
    case "matchPairs": {
      const [question, reason] = [block(item.question), block(item.reason)];
      const pairs = item.pairs.map((pair) => ({ left: line(pair.left), right: line(pair.right) }));
      return { ...item, pairs, question, reason };
    }
    case "order": {
      const [question, reason] = [block(item.question), block(item.reason)];
      return { ...item, question, reason, steps: item.steps.map(line) };
    }
    case "numeric": {
      const [context, question] = [support(item.context), block(item.question)];
      const steps = item.math.steps.map((step) => ({ ...step, text: block(step.text) }));
      return { ...item, context, math: { ...item.math, steps }, question };
    }
    default:
      throw new Error("Unknown item format.");
  }
}

/** Every text a learner reads with an item, with how it shows (see `mapItemWriting`). */
export function getItemWriting(item: GeneratedItem): ItemText[] {
  const texts: ItemText[] = [];

  mapItemWriting(item, (entry) => {
    texts.push(entry);
    return entry.text;
  });

  return texts;
}
