import { type LanguageLessonContent } from "@zoonk/ai/tasks/language/language-lesson";
import { type ActivityStepContent } from "../../activities/activity-templates";
import { validateActivity } from "../../activities/validate-activity";

type PatternTable = NonNullable<LanguageLessonContent["patternTable"]>;
type Dialogue = NonNullable<LanguageLessonContent["dialogue"]>;

/** A rejected activity leaves its lesson without it; its issues say why. */
type BuiltActivity = { content: ActivityStepContent | null; issues: string[] };

/** A meaning the learner doesn't need (one who reads the app in the language they learn) is left out. */
function meaning(key: string, text: string | null) {
  return text ? { [key]: text } : {};
}

function toPatternTableContent(table: PatternTable) {
  return {
    check: { explanation: table.explanation, kind: "interaction" },
    fields: {
      choices: table.choices,
      ...meaning("modelMeaning", table.modelMeaning),
      modelWord: table.modelWord,
      ...meaning("newMeaning", table.newMeaning),
      newWord: table.newWord,
      rows: table.rows.map((row) => ({
        answer: row.answer,
        blank: row.blank,
        label: row.label,
        ...meaning("labelMeaning", row.labelMeaning),
        model: row.model,
      })),
    },
    prompt: table.prompt,
    template: "patternTable",
  };
}

/** Replies are numbered, so a dialogue the fix left alone builds the same screen again. */
function toDialogueContent({ dialogue, language }: { dialogue: Dialogue; language: string }) {
  return {
    check: { explanation: dialogue.explanation, kind: "interaction" },
    fields: {
      language,
      lines: dialogue.lines,
      replies: dialogue.replies.map((reply, index) => ({ ...reply, id: `reply-${index + 1}` })),
      scene: dialogue.scene,
    },
    prompt: dialogue.prompt,
    template: "dialogueSimulator",
  };
}

function build(content: object | null): BuiltActivity {
  if (!content) {
    return { content: null, issues: [] };
  }

  const validated = validateActivity(content);

  return validated.ok
    ? { content: validated.content, issues: [] }
    : {
        content: null,
        issues: validated.issues.map((issue) =>
          issue.path ? `${issue.path}: ${issue.message}` : issue.message,
        ),
      };
}

/** The lesson's pattern table and dialogue as activity screens, each null when absent or rejected. */
export function buildLanguageActivities({
  content,
  targetLanguage,
}: {
  content: LanguageLessonContent;
  targetLanguage: string;
}) {
  return {
    dialogue: build(
      content.dialogue &&
        toDialogueContent({ dialogue: content.dialogue, language: targetLanguage }),
    ),
    patternTable: build(content.patternTable && toPatternTableContent(content.patternTable)),
  };
}

/** Why each activity the writer wrote was left out of its lesson. */
export function listDroppedLanguageActivities(
  input: Parameters<typeof buildLanguageActivities>[0],
) {
  return Object.entries(buildLanguageActivities(input)).flatMap(([template, built]) =>
    built.issues.length > 0 ? [`The ${template} was left out: ${built.issues.join("; ")}`] : [],
  );
}
