import { ListGroup, ListRow, ListRowContent, ListRowNumberedTitle } from "@zoonk/learn/list";
import { getExtracted } from "next-intl/server";
import {
  EXAMPLE_ROWS_CLASS,
  ExampleCard,
  ExampleCardHead,
  getExampleDailyTime,
} from "./example-card";
import { GoalSection } from "./goal-section";
import { getExampleSet } from "./landing-examples";

const TITLE_ID = "topic-title";

const DAILY_MINUTES = 15;

async function TopicCourse() {
  const t = await getExtracted();
  const { topic } = await getExampleSet();

  return (
    <ExampleCard>
      <ExampleCardHead detail={await getExampleDailyTime(DAILY_MINUTES)} title={topic.name} />

      <p className="mt-4 text-sm font-semibold">{t("Chapters")}</p>

      <ListGroup className={`${EXAMPLE_ROWS_CLASS} mt-1`} role="list">
        {topic.chapters.map((chapter, index) => (
          <ListRow key={chapter} role="listitem">
            <ListRowContent>
              <ListRowNumberedTitle number={index + 1}>{chapter}</ListRowNumberedTitle>
            </ListRowContent>
          </ListRow>
        ))}
      </ListGroup>

      <p className="text-muted-foreground pt-2.5 text-[0.8125rem]">
        {t("{count, plural, one {And # more chapter} other {And # more chapters}}", {
          count: topic.laterChapters,
        })}
      </p>
    </ExampleCard>
  );
}

export async function TopicSection() {
  const t = await getExtracted();
  const { topic } = await getExampleSet();

  return (
    <GoalSection
      label={t({
        description:
          "A section label for learning any subject out of curiosity. In Brazilian Portuguese: “Qualquer assunto”.",
        message: "Any subject",
      })}
      lead={t({
        description:
          "{subjects} lists three subjects people learn out of curiosity, such as “Física quântica, história da arte, como funciona a bolsa de valores”, and opens the text. In Brazilian Portuguese: “{subjects}. Escreva o que quer entender e o plano vira capítulos em ordem, com aulas curtas.”",
        message:
          "{subjects}. Write what you want to understand and your plan turns it into chapters, in order, with short lessons.",
        values: { subjects: topic.subjects },
      })}
      subject="science"
      title={t({
        description: "In Brazilian Portuguese: “Por curiosidade, um curso do zero.”",
        message: "Just curious? A course from scratch.",
      })}
      titleId={TITLE_ID}
    >
      <TopicCourse />
    </GoalSection>
  );
}
