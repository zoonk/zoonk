import { getExtracted } from "next-intl/server";
import { ExampleCard, ExampleDay } from "./example-card";
import { GoalSection } from "./goal-section";
import { getExampleSet } from "./landing-examples";
import { getLanguageDay } from "./language-day";

const TITLE_ID = "languages-title";

async function getLead(): Promise<string> {
  const t = await getExtracted();
  const { move } = await getExampleSet();

  return move === "mexico-city"
    ? t({
        description: "Use your language's name for Mexico City.",
        message:
          "To move to Mexico City, your plan has a conversation for renting an apartment, the pronunciation and grammar you'll use, and quick reviews of what you've seen.",
      })
    : t({
        description:
          "Use your language's name for London. In Brazilian Portuguese: “Para morar em Londres, o plano tem conversa para alugar um apartamento, a pronúncia e a gramática que você vai usar, e revisões rápidas do que já viu.”",
        message:
          "To move to London, your plan has a conversation for renting a flat, the pronunciation and grammar you'll use, and quick reviews of what you've seen.",
      });
}

export async function LanguageSection() {
  const t = await getExtracted();
  const day = await getLanguageDay();

  return (
    <GoalSection
      label={t("Languages")}
      lead={await getLead()}
      subject="languages"
      title={t({
        description: "In Brazilian Portuguese: “O idioma das situações que você vai viver.”",
        message: "The language for the situations you'll be in.",
      })}
      titleId={TITLE_ID}
    >
      <ExampleCard className="pb-1.5 sm:pb-1.5">
        <ExampleDay detail={day.name} steps={day.steps} />
      </ExampleCard>
    </GoalSection>
  );
}
