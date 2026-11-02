import { type ExamStructure } from "./blueprint-contract";

type DescribedFormat = Pick<ExamStructure["formats"][number], "description" | "kind" | "options">;

export function describeFormat(format: DescribedFormat): string {
  return format.options
    ? `${format.kind} (${format.options} options): ${format.description}`
    : `${format.kind}: ${format.description}`;
}
