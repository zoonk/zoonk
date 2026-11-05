import { replaceEmDashes } from "@zoonk/utils/string";
import { z } from "zod";
import { type IconNeed, toIconNeed } from "../icons/icon-need";
import { isExampleQuote, isUnderlineQuote } from "./mark-quotes";

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the ideas' icons come before the screens' icons that must differ from them, and each screen's idea before what it marks. */

const iconNeedSchema = z.object({
  name: z.string(),
  searchWords: z.array(z.string()),
  description: z.string(),
});

export const lessonMarksOutputSchema = z.object({
  ideas: z.array(z.object({ idea: z.int(), about: z.string(), icon: iconNeedSchema.nullable() })),
  screens: z.array(
    z.object({
      screen: z.int(),
      idea: z.int().nullable(),
      underline: z.string().nullable(),
      example: z.string().nullable(),
      icon: iconNeedSchema.nullable(),
    }),
  ),
});

/* oxlint-enable eslint/sort-keys */

type LessonMarksOutput = z.infer<typeof lessonMarksOutputSchema>;

/**
 * `explanation` and `workedExample` carry their marked text (`text`, `problem`); a question or a
 * guess only its wording, to place it under an idea.
 */
export type MarksScreen = {
  kind: "explanation" | "guess" | "question" | "workedExample";
  title: string | null;
  text: string;
  /** An explanation with its own picture, visual or activity never gets an icon. */
  hasVisual: boolean;
};

export type MarksIdea = { label: string | null; text: string };

export type ScreenMarks = {
  ideaIndex: number | null;
  underline: string | null;
  example: string | null;
  icon: IconNeed | null;
};

type IdeaMarks = { about: string | null; icon: IconNeed | null };

export type LessonMarks = { ideas: IdeaMarks[]; screens: ScreenMarks[] };

const MAX_ABOUT_LENGTH = 80;
const BOLD_WRAP = /^\*\*(?<inner>[^*]+)\*\*$/u;

export function canScreenGetIcon(screen: MarksScreen): boolean {
  return screen.kind === "explanation" && !screen.hasVisual;
}

function toUnderline({ quote, screen }: { quote: string | null; screen: MarksScreen }) {
  if (!quote || (screen.kind !== "explanation" && screen.kind !== "workedExample")) {
    return null;
  }

  const trimmed = quote.trim();
  const unwrapped = BOLD_WRAP.exec(trimmed)?.groups?.inner ?? trimmed;

  return isUnderlineQuote({ quote: unwrapped, text: screen.text }) ? unwrapped : null;
}

function toExample({ quote, screen }: { quote: string | null; screen: MarksScreen }) {
  const trimmed = quote?.trim();

  return trimmed &&
    screen.kind === "explanation" &&
    trimmed !== screen.text.trim() &&
    isExampleQuote({ quote: trimmed, text: screen.text })
    ? trimmed
    : null;
}

function toIdeaIndex({ idea, ideaCount }: { idea: number | null; ideaCount: number }) {
  return idea !== null && idea >= 1 && idea <= ideaCount ? idea - 1 : null;
}

function toAbout(about: string | undefined): string | null {
  const line = about ? replaceEmDashes(about.replaceAll("*", "").trim()) : "";
  return line && line.length <= MAX_ABOUT_LENGTH ? line : null;
}

/** The map shows the ideas side by side to tell them apart, so an icon an earlier idea has goes. */
function keepIdeaIconsApart(icons: readonly (IconNeed | null)[]): (IconNeed | null)[] {
  return icons.map((icon, index) =>
    icon && icons.slice(0, index).some((earlier) => earlier?.name === icon.name) ? null : icon,
  );
}

/** A screen shows its idea's icon above its text, so the same icon beside the text goes. */
function toScreenIcon({
  ideaIcon,
  marked,
  screen,
}: {
  ideaIcon: IconNeed | null;
  marked: IconNeed | null | undefined;
  screen: MarksScreen;
}): IconNeed | null {
  const icon = canScreenGetIcon(screen) ? toIconNeed(marked) : null;
  return icon && icon.name !== ideaIcon?.name ? icon : null;
}

/** Keeps what fits the lesson and drops the rest, as the pipeline and the eval both read it. */
export function normalizeLessonMarks({
  ideas,
  output,
  screens,
}: {
  ideas: readonly MarksIdea[];
  output: LessonMarksOutput;
  screens: readonly MarksScreen[];
}): LessonMarks {
  const byScreen = new Map(output.screens.map((item) => [item.screen, item]));
  const byIdea = new Map(output.ideas.map((item) => [item.idea, item]));

  const ideaIcons = keepIdeaIconsApart(
    ideas.map((_idea, index) => toIconNeed(byIdea.get(index + 1)?.icon)),
  );

  return {
    ideas: ideas.map((_idea, index) => ({
      about: toAbout(byIdea.get(index + 1)?.about),
      icon: ideaIcons[index] ?? null,
    })),
    screens: screens.map((screen, index) => {
      const marked = byScreen.get(index + 1);
      const ideaIndex = toIdeaIndex({ idea: marked?.idea ?? null, ideaCount: ideas.length });

      return {
        example: toExample({ quote: marked?.example ?? null, screen }),
        icon: toScreenIcon({
          ideaIcon: ideaIndex === null ? null : (ideaIcons[ideaIndex] ?? null),
          marked: marked?.icon,
          screen,
        }),
        ideaIndex,
        underline: toUnderline({ quote: marked?.underline ?? null, screen }),
      };
    }),
  };
}
