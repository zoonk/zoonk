import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "@zoonk/learn/list";
import { StatusMark } from "@zoonk/learn/status-mark";
import { getExtracted } from "next-intl/server";
import {
  EXAMPLE_ROWS_CLASS,
  ExampleCard,
  ExampleCardHead,
  getExampleDailyTime,
} from "./example-card";
import { GoalSection } from "./goal-section";
import { getExampleSet } from "./landing-examples";

const TITLE_ID = "career-title";

const DAILY_MINUTES = 60;

async function CareerPlan() {
  const t = await getExtracted();
  const { career } = await getExampleSet();
  const [today, ...ahead] = career.topics;

  const lessons = (count: number) =>
    t("{count, plural, one {# lesson} other {# lessons}}", { count });

  return (
    <ExampleCard>
      <ExampleCardHead detail={await getExampleDailyTime(DAILY_MINUTES)} title={career.name} />

      <ListGroup className={`${EXAMPLE_ROWS_CLASS} isolate mt-3`} role="list">
        <ListRow role="listitem">
          <ListRowLeading>
            <StatusMark status="skipped" />
          </ListRowLeading>
          <ListRowContent>
            <ListRowTitle className="text-muted-foreground font-normal">
              {career.skipped}
            </ListRowTitle>
          </ListRowContent>
          <ListRowTrailing className="font-sans">
            {t({
              description:
                "Ends a plan row for a topic the plan skips because the learner already knows it. In Brazilian Portuguese: “Você já sabe”.",
              message: "You know this",
            })}
          </ListRowTrailing>
        </ListRow>

        <ListRow data-highlighted role="listitem">
          <ListRowLeading>
            <StatusMark status="next" />
          </ListRowLeading>
          <ListRowContent>
            <ListRowTitle>{today.title}</ListRowTitle>
            <ListRowDescription>{t("Starts today")}</ListRowDescription>
          </ListRowContent>
          <ListRowTrailing>{lessons(today.lessons)}</ListRowTrailing>
        </ListRow>

        {ahead.map((topic) => (
          <ListRow key={topic.title} role="listitem">
            <ListRowLeading>
              <StatusMark status="todo" />
            </ListRowLeading>
            <ListRowContent>
              <ListRowTitle className="font-normal">{topic.title}</ListRowTitle>
            </ListRowContent>
            <ListRowTrailing>{lessons(topic.lessons)}</ListRowTrailing>
          </ListRow>
        ))}
      </ListGroup>
    </ExampleCard>
  );
}

function renderQuote(chunks: React.ReactNode) {
  return <q>{chunks}</q>;
}

export async function CareerSection() {
  const t = await getExtracted();
  const { career } = await getExampleSet();

  return (
    <GoalSection
      label={t({
        description:
          "A section label for goals like changing careers. In Brazilian Portuguese: “Nova carreira”.",
        message: "New career",
      })}
      lead={t.rich({
        description:
          "{goal} is an example goal like “become a data analyst in 6 months”; <quote> puts your language's quote marks around it. In Brazilian Portuguese: “Diga aonde quer chegar, como <quote>{goal}</quote>. O plano vai do básico às ferramentas da área e pula o que você já sabe.”",
        message:
          "Say where you want to get, like <quote>{goal}</quote>. Your plan goes from the basics to the tools of the field and skips what you already know.",
        values: { goal: career.goal, quote: renderQuote },
      })}
      subject="business"
      title={t({
        description: "In Brazilian Portuguese: “Para mudar de área, o que estudar e em que ordem.”",
        message: "Changing careers? What to study, and in what order.",
      })}
      titleId={TITLE_ID}
    >
      <CareerPlan />
    </GoalSection>
  );
}
