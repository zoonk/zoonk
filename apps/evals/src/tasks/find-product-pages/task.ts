import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type FindProductPagesParams,
  type ProductPages,
  findProductPages,
} from "@zoonk/ai/tasks/research/find-product-pages";
import { TEST_CASES } from "./test-cases";

/** Each address must start with one of these (a host, a path or a query); null expects none. */
export type FindProductPagesExpected = Partial<Record<keyof ProductPages, string[] | null>>;

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

function isOnSite({ sites, url }: { sites: string[]; url: string }): boolean {
  if (!URL.canParse(url)) {
    return false;
  }

  const { hostname, pathname, search } = new URL(url);
  const address = `${hostname.replace(/^www\./u, "")}${pathname}${search}`;

  return sites.some((site) => address.startsWith(site) || address.includes(`.${site}`));
}

const scorePages: TaskScorer<FindProductPagesExpected> = ({ output, testCase }) => {
  let pages: ProductPages | null = null;

  try {
    pages = JSON.parse(output) as ProductPages;
  } catch {
    pages = null;
  }

  if (!pages || !testCase.expected) {
    return createFixedScore({ conclusion: "No pages", score: MIN_SCORE });
  }

  const found = pages;

  const checks = Object.entries(testCase.expected).map(([field, sites]) => {
    const url = found[field as keyof ProductPages];

    return {
      field,
      passed: sites === null ? url === null : url !== null && isOnSite({ sites, url }),
    };
  });

  const failed = checks.filter((check) => !check.passed).map((check) => check.field);

  return createFixedScore({
    conclusion: failed.length === 0 ? "None" : `Wrong: ${failed.join(", ")}`,
    score: MIN_SCORE + (SCORE_RANGE * (checks.length - failed.length)) / checks.length,
  });
};

export const findProductPagesTask: Task<
  FindProductPagesParams,
  ProductPages,
  FindProductPagesExpected
> = {
  description:
    "Find a product maker's official brand, product, docs and releases pages, and the learner's release page",
  generate: findProductPages,
  id: "find-product-pages",
  name: "Find Product Pages",
  score: scorePages,
  testCases: TEST_CASES,
};
