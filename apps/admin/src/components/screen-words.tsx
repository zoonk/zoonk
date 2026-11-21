import { toWords } from "@/lib/format";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";
import { isJsonObject } from "@zoonk/utils/json";
import { ContentAnswer, ContentWords, Options, Prose, jsonObjects, textOf } from "./content-words";

type Fields = Record<string, unknown>;

function MatchPairs({ pairs, lang }: { pairs: Fields[]; lang?: string }) {
  if (pairs.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-2">
      {pairs.map(({ left, right }) => (
        <li key={JSON.stringify([left, right])}>
          <bdi lang={lang}>{textOf(left)}</bdi> → <bdi>{textOf(right)}</bdi>
        </li>
      ))}
    </ul>
  );
}

function AlphabetWords({ content, lang }: { content: Fields; lang?: string }) {
  const symbol = textOf(content.symbol);

  return symbol ? (
    <>
      <p className="font-medium" lang={lang}>
        <bdi>{symbol}</bdi>
      </p>
      <ContentAnswer label="Pronunciation">{textOf(content.pronunciation)}</ContentAnswer>
      <Prose quiet>{textOf(content.readingAid)}</Prose>
      {jsonObjects(content.forms).map((form) => (
        <ContentAnswer key={JSON.stringify(form)} label={textOf(form.label) ?? "Form"} lang={lang}>
          {textOf(form.symbol)}
        </ContentAnswer>
      ))}
    </>
  ) : null;
}

function ActivityCheckWords({ check }: { check: Fields }) {
  const answer = typeof check.answer === "number" ? String(check.answer) : null;

  return (
    <>
      <Prose>{textOf(check.question)}</Prose>
      <Options options={jsonObjects(check.options)} />
      <ContentAnswer label="Answer">
        {answer ? [answer, textOf(check.unit)].filter(Boolean).join(" ") : null}
      </ContentAnswer>
      <Prose quiet>{textOf(check.explanation)}</Prose>
    </>
  );
}

function ChallengeWords({ content }: { content: Fields }) {
  const nodes = jsonObjects(content.nodes);
  const endings = jsonObjects(content.endings);

  return (
    <>
      <ContentAnswer label="Setting">{textOf(content.setting)}</ContentAnswer>
      <ContentAnswer label="Deadline">{textOf(content.deadline)}</ContentAnswer>
      {nodes.map((node) => (
        <div className="flex flex-col gap-2" key={String(node.id)}>
          {jsonObjects(node.messages).map((message) => (
            <Prose key={JSON.stringify(message)} quiet>
              {textOf(message.text)}
            </Prose>
          ))}
          <Prose>{textOf(node.prompt)}</Prose>
          <ul className="flex flex-col gap-2">
            {jsonObjects(node.choices).map((choice) => (
              <li key={String(choice.id)}>{textOf(choice.text)}</li>
            ))}
          </ul>
        </div>
      ))}
      {endings.map((ending) => (
        <Prose key={String(ending.id)}>{textOf(ending.outcome)}</Prose>
      ))}
    </>
  );
}

function TypedAnswerWords({ content }: { content: Fields }) {
  const points = Array.isArray(content.keyPoints) ? content.keyPoints.filter(textOf) : [];

  return (
    <>
      <ContentAnswer label="Sample answer">{textOf(content.sampleAnswer)}</ContentAnswer>
      <Prose quiet>{points.map((point) => `- ${String(point)}`).join("\n") || null}</Prose>
    </>
  );
}

export function screenKindLabel({ content, kind }: { content: unknown; kind: string }): string {
  const fields = isJsonObject(content) ? content : {};
  const variant = kind === "activity" ? fields.template : fields.variant;

  return [kind, typeof variant === "string" && variant !== "text" ? variant : null]
    .filter((part) => part !== null)
    .map((part) => toWords(part))
    .join(FACT_SEPARATOR);
}

function distinctTranslation(
  translation: string | null | undefined,
  original: string,
): string | null {
  return translation && translation !== original ? translation : null;
}

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
  const meaning = distinctTranslation(translation, word);

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
  lang?: string;
  sentence?: string | null;
  translation?: string | null;
  word?: string | null;
}) {
  const fields = isJsonObject(content) ? content : {};

  if (kind === "alphabet") {
    return <AlphabetWords content={fields} lang={lang} />;
  }

  return (
    <>
      {word ? <WordScreen kind={kind} lang={lang} translation={translation} word={word} /> : null}
      {sentence && (kind === "reading" || kind === "listening") ? (
        <>
          <p lang={lang}>{sentence}</p>
          <ContentAnswer label="Translation">
            {distinctTranslation(translation, sentence)}
          </ContentAnswer>
        </>
      ) : null}
      <ContentWords content={content} />
      {kind === "matchColumns" && <MatchPairs lang={lang} pairs={jsonObjects(fields.pairs)} />}
      {kind === "activity" && isJsonObject(fields.check) && (
        <ActivityCheckWords check={fields.check} />
      )}
      {kind === "challenge" && <ChallengeWords content={fields} />}
      {kind === "spokenAnswer" && (
        <ContentAnswer label="Romanization">{textOf(fields.romanization)}</ContentAnswer>
      )}
      {kind === "typedAnswer" && <TypedAnswerWords content={fields} />}
    </>
  );
}
