import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import {
  DISCLOSURE_ANSWER_CLASS,
  DISCLOSURE_LINK_CLASS,
  PublicDisclosure,
} from "@/components/public/public-disclosure";
import { getAppLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { cn } from "@zoonk/ui/lib/utils";
import { getSentenceSpace } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { getExampleSet } from "./landing-examples";

const TITLE_ID = "faq-title";

function renderHelpLink(chunks: React.ReactNode) {
  return (
    <Link className={DISCLOSURE_LINK_CLASS} href="/support">
      {chunks}
    </Link>
  );
}

export async function HomeFaq() {
  const t = await getExtracted();
  const space = getSentenceSpace(await getAppLocale());
  const { exams } = await getExampleSet();
  const limits = getFreePlanLimits();

  const questions = [
    {
      answer: t(
        "Yes. You start free, no account needed. A free account gives you {lessons, plural, one {# lesson} other {# lessons}} a month, for {goals, plural, one {one goal} other {up to # goals}} at a time. No card needed.",
        { goals: limits.activeGoals ?? 0, lessons: limits.lessonsPerMonth ?? 0 },
      ),
      id: "free",
      question: t("Is Zoonk free?"),
    },
    {
      answer: (
        <>
          {t(
            "Every lesson and every goal, with no monthly limit. For an exam, that's your whole plan up to exam day, with mock exams timed like the real one. You also get help whenever you're stuck and more speaking practice. You see your whole plan before you pay, and you can cancel anytime.",
          )}
          {space}
          <Link className={DISCLOSURE_LINK_CLASS} href="/pricing">
            {t("See prices")}
          </Link>
        </>
      ),
      id: "plus",
      question: t("What do I get if I subscribe?"),
    },
    {
      answer: t({
        description:
          "In Brazilian Portuguese: “As aulas são criadas com os modelos de IA mais recentes e conferidas antes de chegar até você: a gente testa a qualidade com várias avaliações, e outros modelos revisam o conteúdo. Elas seguem as matérias e os tópicos da sua prova. Erros são raros, mas podem acontecer. Viu algo errado? Avise a gente pela própria aula e vamos conferir.”",
        message:
          "Lessons are made with the latest AI models and checked before they reach you: we test their quality with several evaluations, and other models review the content. They follow your exam's subjects and topics. Mistakes are rare, but they can happen. See something wrong? Tell us from the lesson and we'll look into it.",
      }),
      id: "trust",
      question: t({
        description: "In Brazilian Portuguese: “Dá para confiar em aulas criadas por IA?”",
        message: "Can you trust lessons made by AI?",
      }),
    },
    {
      answer: t({
        description:
          "In Brazilian Portuguese: “Os apps para iPhone e Android estão chegando. Por enquanto, o Zoonk funciona no navegador do celular e do computador, sem instalar nada.”",
        message:
          "The iPhone and Android apps are coming soon. For now, Zoonk works in your phone's or computer's browser, with nothing to install.",
      }),
      id: "app",
      question: t("Is there an app?"),
    },
    {
      answer: t(
        "What's left comes first the next day. If a date changes, your plan tells you. You can also change how long you study each day whenever you want.",
      ),
      id: "missed",
      question: t({
        description: "In Brazilian Portuguese: “E se eu faltar um dia?”",
        message: "What if I miss a day?",
      }),
    },
    {
      answer: t({
        description:
          "{exams} lists exams people in your country study for, ending with a school test, such as “concurso, Enem, OAB, vestibular ou prova da escola”. In Brazilian Portuguese: “Qualquer prova, como concurso, Enem, OAB, vestibular ou prova da escola. Também idiomas, uma nova carreira ou qualquer assunto que você queira aprender. Escreva seu objetivo do seu jeito.”",
        message:
          "Any exam, such as {exams}. Also languages, a new career or any topic you want to learn. Write your goal in your own words.",
        values: { exams },
      }),
      id: "goals",
      question: t({
        description: "In Brazilian Portuguese: “Quais provas e objetivos dá para estudar?”",
        message: "Which exams and goals can I study for?",
      }),
    },
  ];

  return (
    <section aria-labelledby={TITLE_ID}>
      <div
        className={cn(
          PUBLIC_CONTAINER_CLASS,
          "grid grid-cols-1 gap-8 py-26 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20 lg:py-36",
        )}
      >
        <div>
          <h2 className="text-headline" id={TITLE_ID}>
            {t("Frequently asked questions")}
          </h2>
          <p className="text-muted-foreground mt-3.5">
            {t.rich("Still have questions? <link>Ask us</link>.", { link: renderHelpLink })}
          </p>
        </div>

        <div className="border-b">
          {questions.map((item, index) => (
            <PublicDisclosure
              className="border-t"
              key={item.id}
              open={index === 0}
              summary={item.question}
            >
              <p className={cn(DISCLOSURE_ANSWER_CLASS, "pr-9")}>{item.answer}</p>
            </PublicDisclosure>
          ))}
        </div>
      </div>
    </section>
  );
}
