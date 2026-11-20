import {
  DISCLOSURE_ANSWER_CLASS,
  DISCLOSURE_LINK_CLASS,
  PublicDisclosure,
} from "@/components/public/public-disclosure";
import { PublicQuestions } from "@/components/public/public-questions";
import { getAppLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { cn } from "@zoonk/ui/lib/utils";
import { getSentenceSpace } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { getExampleSet } from "./landing-examples";

const TITLE_ID = "faq-title";

export async function HomeFaq() {
  const t = await getExtracted();
  const space = getSentenceSpace(await getAppLocale());
  const { exams } = await getExampleSet();
  const limits = getFreePlanLimits();

  const questions = [
    {
      answer: t(
        "Yes. You start free, no account needed. A free account gives you {lessons, plural, one {# lesson} other {# lessons}} a month across all your goals, exams included, with {goals, plural, one {one goal} other {up to # goals}} at a time. No card needed.",
        { goals: limits.activeGoals ?? 0, lessons: limits.lessonsPer30Days ?? 0 },
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
          "In Brazilian Portuguese: “As aulas são criadas com os modelos de IA mais recentes e passam por verificações automáticas antes de chegar até você. Depois, outro modelo de IA revisa as aulas e corrige os erros que encontra. Elas seguem o que o seu objetivo cobre, como as matérias e os tópicos de uma prova. A IA ainda pode errar. Viu um erro? Avise a gente pela própria aula e a gente confere.”",
        message:
          "Lessons are made with the latest AI models and pass automatic checks before they reach you. Then another AI model reviews them and fixes the mistakes it finds. They follow what your goal covers, such as an exam's subjects and topics. AI can still make mistakes. See one? Tell us from the lesson and we'll look into it.",
      }),
      id: "trust",
      question: t({
        description:
          "A question in the landing page's FAQ, asked by the visitor. In Brazilian Portuguese: “Posso confiar em aulas criadas por IA?”",
        message: "Can I trust lessons made by AI?",
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
        description:
          "A question in the landing page's FAQ, asked by the visitor. In Brazilian Portuguese: “Para quais provas e objetivos eu posso estudar?”",
        message: "Which exams and goals can I study for?",
      }),
    },
  ];

  return (
    <PublicQuestions id={TITLE_ID}>
      {questions.map((item, index) => (
        <PublicDisclosure key={item.id} open={index === 0} summary={item.question}>
          <p className={cn(DISCLOSURE_ANSWER_CLASS, "pr-9")}>{item.answer}</p>
        </PublicDisclosure>
      ))}
    </PublicQuestions>
  );
}
