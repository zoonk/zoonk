import { AdminAnswerMarkdown } from "@/components/admin-answer-markdown";
import { isJsonObject } from "@zoonk/utils/json";
import { CheckIcon } from "lucide-react";

type Fields = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function list(value: unknown): Fields[] {
  return Array.isArray(value) ? value.filter((entry) => isJsonObject(entry)) : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

function Prose({ children, quiet }: { children: string | null; quiet?: boolean }) {
  if (!children) {
    return null;
  }

  return (
    <div className={quiet ? "text-muted-foreground" : undefined}>
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
        const reason = text(option.reason) ?? text(option.feedback);

        return (
          <li className="flex items-start gap-3" key={String(option.id ?? option.text)}>
            {option.isCorrect === true ? (
              <CheckIcon aria-label="Right answer" className="text-success mt-1 size-4 shrink-0" />
            ) : (
              <span
                aria-hidden="true"
                className="border-field mt-1 size-4 shrink-0 rounded-full border"
              />
            )}
            <span className="flex min-w-0 flex-col">
              <span className={option.isCorrect === true ? "font-medium" : undefined}>
                {text(option.text)}
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

function Answer({ children, label }: { children: string | null; label: string }) {
  if (!children) {
    return null;
  }

  return (
    <p className="text-muted-foreground">
      {label}: <span className="text-foreground font-medium">{children}</span>
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

  const steps = list(content.steps);
  const ideas = list(content.ideas);
  const blanks = strings(content.answers);
  const accepted = strings(content.acceptedAnswers);

  return (
    <>
      {text(content.title) ? <p className="font-medium">{text(content.title)}</p> : null}
      <Prose quiet>{text(content.context)}</Prose>
      <Prose>
        {text(content.text) ??
          text(content.problem) ??
          text(content.question) ??
          text(content.statement) ??
          text(content.prompt) ??
          text(content.mission)}
      </Prose>
      {content.kind === undefined && text(content.template) && blanks.length > 0 ? (
        <p className="font-medium">{text(content.template)}</p>
      ) : null}

      {steps.length > 0 ? (
        <ol className="text-muted-foreground flex flex-col gap-1">
          {steps.map((step) => (
            <li key={String(step.text)}>
              <Prose quiet>
                {[text(step.text), text(step.math) && `$${String(step.math)}$`]
                  .filter(Boolean)
                  .join(" ")}
              </Prose>
            </li>
          ))}
        </ol>
      ) : null}

      {ideas.length > 0 ? (
        <ul className="flex list-outside list-disc flex-col gap-1 ps-4">
          {ideas.map((idea) => (
            <li key={String(idea.text)}>
              <Prose>{text(idea.text)}</Prose>
            </li>
          ))}
        </ul>
      ) : null}

      <Options options={list(content.options)} />
      <Prose>{text(content.result) ?? text(content.reveal)}</Prose>
      <Answer label="Answer">{blanks.join(", ") || text(content.targetText)}</Answer>
      <Answer label="Also offered">{strings(content.distractors).join(", ") || null}</Answer>
      <Answer label="Accepted">{accepted.join(" · ") || null}</Answer>
      <Prose quiet>{text(content.translation) ?? text(content.feedback)}</Prose>
    </>
  );
}
