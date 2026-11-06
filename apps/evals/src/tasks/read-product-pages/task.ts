import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type ProductReading,
  type ReadProductPagesParams,
  readProductPages,
} from "@zoonk/ai/tasks/research/read-product-pages";
import {
  type CheckedProductReading,
  checkProductReading,
} from "@zoonk/core/library/products/product-reading";
import { normalizeString } from "@zoonk/utils/string";
import { TEST_CASES } from "./test-cases";

export type ReadProductPagesInput = ReadProductPagesParams & { language: string };

export type ReadProductPagesExpected = {
  brand: string | null;
  product: string | null;
  /** Each must survive the passage checks, with this date (null: no date survives). */
  releases: { name: string; releasedOn: string | null }[];
  /** Releases the pages don't state, which the reading must never keep. */
  absent?: string[];
  noReleases?: boolean;
  learnerRelease?: string | null;
};

type ReadOutput = { checked: CheckedProductReading; reading: ProductReading };

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

function isSameName(left: string | null | undefined, right: string): boolean {
  return normalizeString(left ?? "") === normalizeString(right);
}

/** The reading as production keeps it: the same passage checks run before anything is saved. */
async function generate(input: ReadProductPagesInput) {
  const result = await readProductPages(input);
  const pages = input.pages.map((page) => ({ language: input.language, text: page.text }));

  return {
    ...result,
    data: { checked: checkProductReading({ pages, reading: result.data }), reading: result.data },
  };
}

function toDay(date: Date | string | null): string | null {
  return date ? new Date(date).toISOString().slice(0, 10) : null;
}

function listChecks({
  expected,
  output,
}: {
  expected: ReadProductPagesExpected;
  output: ReadOutput;
}) {
  const { checked, reading } = output;
  const kept = checked.releases;

  return [
    {
      label: `brand ${expected.brand ?? "none"}`,
      passed: expected.brand ? isSameName(checked.brand?.name, expected.brand) : !checked.brand,
    },
    {
      label: `product ${expected.product ?? "none"}`,
      passed: expected.product
        ? isSameName(checked.product?.name, expected.product)
        : !checked.product,
    },
    ...expected.releases.map((release) => {
      const found = kept.find((item) => isSameName(item.name, release.name));

      return {
        label: `${release.name} dated ${release.releasedOn ?? "unknown"}`,
        passed: found !== undefined && toDay(found.releasedAt) === release.releasedOn,
      };
    }),
    ...(expected.absent ?? []).map((name) => ({
      label: `no ${name}`,
      passed: !reading.releases.some((release) => isSameName(release.name, name)),
    })),
    ...(expected.noReleases ? [{ label: "no releases", passed: kept.length === 0 }] : []),
    ...(expected.learnerRelease === undefined
      ? []
      : [
          {
            label: `learner release ${expected.learnerRelease ?? "none"}`,
            passed:
              expected.learnerRelease === null
                ? checked.learnerRelease === null
                : isSameName(checked.learnerRelease, expected.learnerRelease),
          },
        ]),
    { label: "every claim's passage found", passed: reading.releases.length === kept.length },
  ];
}

const scoreReading: TaskScorer<ReadProductPagesExpected> = ({ output, testCase }) => {
  const expected = testCase.expected;
  let parsed: ReadOutput | null = null;

  try {
    parsed = JSON.parse(output) as ReadOutput;
  } catch {
    parsed = null;
  }

  if (!parsed || !expected) {
    return createFixedScore({ conclusion: "No reading", score: MIN_SCORE });
  }

  const checks = listChecks({ expected, output: parsed });
  const failed = checks.filter((check) => !check.passed).map((check) => check.label);

  return createFixedScore({
    conclusion: failed.length === 0 ? "None" : `Wrong: ${failed.join("; ")}`,
    score: MIN_SCORE + (SCORE_RANGE * (checks.length - failed.length)) / checks.length,
  });
};

export const readProductPagesTask: Task<
  ReadProductPagesInput,
  ReadOutput,
  ReadProductPagesExpected
> = {
  description:
    "Read a product maker's official pages into its brand, product and releases, each with a passage the page states word for word",
  generate,
  id: "read-product-pages",
  name: "Read Product Pages",
  score: scoreReading,
  testCases: TEST_CASES,
};
