import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { type CourseCategory, isValidCategory } from "@zoonk/utils/categories";

/**
 * Each subject's color, from the palette its lesson pictures are painted in (`@zoonk/ai`'s image
 * style): its soft main hue, or its accent where that hue is a dark navy that would wash to gray
 * (law's gold, business's amber). A course's page wears the look of its lessons, and every course
 * has a face of its own. The one map from a subject to a color on the catalog's pages.
 */
const SUBJECT_COLORS: Readonly<Record<CourseCategory | "general", string>> = {
  arts: "#B69CF0",
  business: "#FBBF24",
  communication: "#7DB8F2",
  culture: "#F2B45A",
  economics: "#7FC8A0",
  engineering: "#7A9CC6",
  general: "#8B93F8",
  geography: "#6BB5D8",
  health: "#F4A6B4",
  history: "#D08C6B",
  languages: "#6E6CD8",
  law: "#D4A72C",
  math: "#5CC8C2",
  science: "#8B93F8",
  society: "#9DBF9E",
  tech: "#6FA8F5",
};

type CategoryRow = { category: string; createdAt: Date };

/**
 * The course's subject color as the page's `--subject`, for its bands to tint themselves with: its
 * first category, the one its lesson pictures take their palette from, or the general one.
 */
export function getSubjectToneStyle(
  categories: readonly CategoryRow[],
): CSSPropertiesWithVariables {
  const [first] = categories.toSorted(
    (one, other) => one.createdAt.getTime() - other.createdAt.getTime(),
  );

  const category = first && isValidCategory(first.category) ? first.category : "general";

  return { "--subject": SUBJECT_COLORS[category] };
}

/**
 * A band across the page's whole width, on its own surface, so where a part of the page starts and
 * ends shows at a glance: to the screen's edges on a phone, the tablet's column (rounded) on a
 * tablet, and from the sidebar to the window's edge from `lg`, its content on the page's own edges.
 */
export const BAND_CLASS =
  "-mx-4 px-4 py-10 sm:-mx-8 sm:rounded-3xl sm:px-8 sm:py-12 lg:-mx-10 lg:rounded-none lg:px-10 lg:py-14";

/**
 * The subject's color washed into the page's background, light in light and dark in dark; a plain
 * page when more contrast is asked for. `soft` is lighter, for the band between the two the color
 * frames. Text keeps AA on every subject's wash in both themes (measured October 2026): on
 * `strong`, only `foreground` and `muted-foreground` (4.7:1 at worst); `faint` labels need `soft`
 * (4.55:1 at worst) or a panel of their own.
 */
export const SUBJECT_WASH_CLASS = {
  soft: "bg-[color-mix(in_srgb,var(--subject)_9%,var(--background))] contrast-more:bg-background",
  strong:
    "bg-[color-mix(in_srgb,var(--subject)_15%,var(--background))] contrast-more:bg-background",
} as const;
