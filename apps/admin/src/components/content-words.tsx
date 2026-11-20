import { AdminAnswerMarkdown } from "@/components/admin-answer-markdown";
import { toWords } from "@/lib/format";
import { cn } from "@zoonk/ui/lib/utils";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";
import { isJsonObject } from "@zoonk/utils/json";
import { CheckIcon } from "lucide-react";

type Fields = Record<string, unknown>;

export function textOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function jsonObjects(value: unknown): Fields[] {
  return Array.isArray(value) ? value.filter((entry) => isJsonObject(entry)) : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

/** A word set in code is one chip: it wraps inside itself instead of splitting in two past the column. */
const CODE_CHIP_CLASS =
  "**:data-[streamdown=inline-code]:inline-block **:data-[streamdown=inline-code]:max-w-full";

function Prose({ children, quiet }: { children: string | null; quiet?: boolean }) {
  if (!children) {
    return null;
  }

  return (
    <div className={cn(CODE_CHIP_CLASS, quiet && "text-muted-foreground")}>
      <AdminAnswerMarkdown answer={children} />
    </div>
  );
}

/** The answers a learner picks from: a check on the right one, and why each is right or wrong. */
function Options({ options }: { options: Fields[] }) {
  if (options.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-2">
      {options.map((option) => {
        const reason = textOf(option.reason) ?? textOf(option.feedback);

        return (
          <li className="flex items-start gap-3" key={String(option.id ?? option.text)}>
            {option.isCorrect === true ? (
              <CheckIcon aria-label="Right answer" className="text-success mt-1 size-4 shrink-0" />
            ) : (
              <span
                aria-hidden="true"
                className="border-input mt-1 size-4 shrink-0 rounded-full border"
              />
            )}
            <span className="flex min-w-0 flex-col">
              <span className={option.isCorrect === true ? "font-medium" : undefined}>
                {textOf(option.text)}
              </span>
              {reason ? (
                <span className="text-muted-foreground text-compact leading-5">{reason}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ContentAnswer({
  children,
  label,
  lang,
}: {
  children: string | null;
  label: string;
  /** The language the answer is in, when it isn't the page's. */
  lang?: string;
}) {
  if (!children) {
    return null;
  }

  return (
    <p className="text-muted-foreground">
      {label}:{" "}
      <span className="text-foreground font-medium" lang={lang}>
        {children}
      </span>
    </p>
  );
}

/**
 * A lesson screen or a practice question as its words, the way a learner reads it: the text, the
 * question and its answers with the right one marked. What a kind keeps besides (a chart's data, a
 * challenge's branches) is in its JSON.
 */
export function ContentWords({ content }: { content: unknown }) {
  if (!isJsonObject(content)) {
    return null;
  }

  const steps = jsonObjects(content.steps);
  const ideas = jsonObjects(content.ideas);
  const blanks = strings(content.answers);
  const accepted = strings(content.acceptedAnswers);

  return (
    <>
      {textOf(content.title) ? <p className="font-medium">{textOf(content.title)}</p> : null}
      <Prose quiet>{textOf(content.context)}</Prose>
      <Prose>
        {textOf(content.text) ??
          textOf(content.problem) ??
          textOf(content.question) ??
          textOf(content.statement) ??
          textOf(content.prompt) ??
          textOf(content.mission)}
      </Prose>
      {content.kind === undefined && textOf(content.template) && blanks.length > 0 ? (
        <p className="font-medium">{textOf(content.template)?.replaceAll("[BLANK]", "____")}</p>
      ) : null}

      {steps.length > 0 ? (
        <ol className="text-muted-foreground flex flex-col gap-1">
          {steps.map((step) => (
            <li key={String(step.text)}>
              <Prose quiet>
                {[textOf(step.text), textOf(step.math) && `$$${String(step.math)}$$`]
                  .filter(Boolean)
                  .join(" ")}
              </Prose>
            </li>
          ))}
        </ol>
      ) : null}

      <Prose>{ideas.map((idea) => `- ${textOf(idea.text) ?? ""}`).join("\n") || null}</Prose>

      <Options options={jsonObjects(content.options)} />
      <Prose>{textOf(content.result) ?? textOf(content.reveal)}</Prose>
      <ContentAnswer label="Answer">
        {blanks.join(", ") || textOf(content.targetText)}
      </ContentAnswer>
      <ContentAnswer label="Wrong options">
        {strings(content.distractors).join(", ") || null}
      </ContentAnswer>
      <ContentAnswer label="Accepted">{accepted.join(FACT_SEPARATOR) || null}</ContentAnswer>
      <Prose quiet>
        {textOf(content.translation) === textOf(content.targetText)
          ? textOf(content.feedback)
          : (textOf(content.translation) ?? textOf(content.feedback))}
      </Prose>
    </>
  );
}

/** "Hook · Guess", "Activity · Chart reader": the kind, then what tells its variants apart. */
export function screenKindLabel({ content, kind }: { content: unknown; kind: string }): string {
  const fields = isJsonObject(content) ? content : {};
  const variant = kind === "activity" ? fields.template : fields.variant;

  return [kind, typeof variant === "string" && variant !== "text" ? variant : null]
    .filter((part) => part !== null)
    .map((part) => toWords(part))
    .join(FACT_SEPARATOR);
}

/** A lesson in the learner's own language translates a word to itself, which says nothing. */
function otherWords(translation: string | null | undefined, word: string): string | null {
  return translation && translation !== word ? translation : null;
}

/** A vocabulary screen shows the word and its meaning; a translation screen asks for the word. */
function WordScreen({
  kind,
  lang,
  translation,
  word,
}: {
  kind: string;
  lang?: string;
  translation?: string | null;
  word: string;
}) {
  const meaning = otherWords(translation, word);

  if (kind === "vocabulary") {
    return (
      <>
        <p lang={lang}>{word}</p>
        <ContentAnswer label="Translation">{meaning}</ContentAnswer>
      </>
    );
  }

  if (kind !== "translation") {
    return null;
  }

  return meaning ? (
    <>
      <p>{meaning}</p>
      <ContentAnswer label="Answer" lang={lang}>
        {word}
      </ContentAnswer>
    </>
  ) : (
    <p lang={lang}>{word}</p>
  );
}

/** A lesson screen the way a learner reads it, with the word or sentence it shows. */
export function ScreenWords({
  content,
  kind,
  lang,
  sentence,
  translation,
  word,
}: {
  content: unknown;
  kind: string;
  /** The language the word or sentence is in. */
  lang?: string;
  sentence?: string | null;
  /** The lesson's translation of the screen's word. */
  translation?: string | null;
  word?: string | null;
}) {
  return (
    <>
      {word ? <WordScreen kind={kind} lang={lang} translation={translation} word={word} /> : null}
      {sentence && (kind === "reading" || kind === "listening") ? (
        <p lang={lang}>{sentence}</p>
      ) : null}
      <ContentWords content={content} />
    </>
  );
}
