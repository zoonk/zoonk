import { type Task } from "@/lib/types";
import {
  type TeachingChaptersParams,
  findTeachingChapters,
} from "@zoonk/ai/tasks/curriculum/teaching-chapters";
import { type TeachingChaptersExpected, scoreTeachingChapters } from "./scorer";
import { TEST_CASES } from "./test-cases";

type TeachingChaptersOutput = Awaited<ReturnType<typeof findTeachingChapters>>["data"];

export const teachingChaptersTask: Task<
  TeachingChaptersParams,
  TeachingChaptersOutput,
  TeachingChaptersExpected
> = {
  description:
    "Find the band chapter that already teaches each skill a plan asks for, so a shared course never writes a topic twice",
  generate: findTeachingChapters,
  id: "teaching-chapters",
  name: "Teaching Chapters",
  score: scoreTeachingChapters,
  testCases: TEST_CASES,
};
