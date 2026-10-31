import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import {
  DISCLOSURE_ANSWER_CLASS,
  DISCLOSURE_LINK_CLASS,
  PublicDisclosure,
} from "@/components/public/public-disclosure";
import { Link } from "@/i18n/navigation";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { getExampleSet } from "./landing-examples";

const TITLE_ID = "faq-title";

function emailLink(address: string) {
  return function renderEmail() {
    return (
      <a className={DISCLOSURE_LINK_CLASS} href={`mailto:${address}`}>
        {address}
      </a>
    );
  };
}

export async function HomeFaq() {
  const t = await getExtracted();
  const { exam } = await getExampleSet();
  const limits = getFreePlanLimits();

  const email = t({
    description: "Zoonk's support address; your language may have its own.",
    message: "hello@zoonk.com",
  });

  const questions = [
    {
      answer: t(
        "You start free, no account needed. With a free account, you follow {goals, plural, one {one goal} other {# goals}} at a time, with a limit on lessons and on messages to Zu. For an exam, the diagnostic, the plan and {days, plural, =7 {the first week} one {the first day} other {the first # days}} of study are free. No card needed.",
        { days: limits.examPrepDays ?? 0, goals: limits.activeGoals ?? 0 },
      ),
      id: "free",
      question: t("Is Zoonk free?"),
    },
    {
      answer: (
        <>
          {t(
            "Plus is a subscription. It unlocks every goal and every lesson, the full plan up to exam day, mock exams timed like the real exam, Zu whenever you need it and higher limits on practice conversations. You see your whole plan before you pay, and you can cancel anytime.",
          )}{" "}
          <Link className={DISCLOSURE_LINK_CLASS} href="/pricing">
            {t("See prices")}
          </Link>
        </>
      ),
      id: "plus",
      question: t({
        description: "In Brazilian Portuguese: “O que o Plus tem a mais?”",
        message: "What does Plus add?",
      }),
    },
    {
      answer: t({
        description:
          "“Report a problem” is the app's menu item for reporting a lesson: use the exact words your language's app uses for it (in Korean “문제 신고하기”). In Brazilian Portuguese: “As aulas são criadas com os modelos de IA mais recentes e conferidas antes de chegar até você: a gente testa a qualidade com várias avaliações, e outros modelos revisam o conteúdo. Elas seguem as matérias e os tópicos da sua prova. Erros são raros, mas podem acontecer. Viu algo errado? Toque em “Relatar um problema”.”",
        message:
          "Lessons are made with the latest AI models and checked before they reach you: we test their quality with several evaluations, and other models review the content. They follow your exam's subjects and topics. Mistakes are rare, but they can happen. See something wrong? Tap “Report a problem”.",
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
        "What's left comes first the next day. If a date changes, your plan tells you. You can also change your daily time whenever you want.",
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
          "{exam} is the country's national exam, such as the Enem or the SAT. In Brazilian Portuguese: “Praticamente qualquer coisa. Provas como o {exam}, vestibulares, concursos públicos e a prova da OAB, idiomas, uma nova carreira ou qualquer assunto que você queira aprender. Escreva sua meta do seu jeito.”",
        message:
          "Pretty much anything. Exams like the {exam}, university entrance exams, civil service exams and the bar exam, languages, a new career or any topic you want to learn. Write your goal in your own words.",
        values: { exam: exam.name },
      }),
      id: "goals",
      question: t({
        description: "In Brazilian Portuguese: “Quais provas e metas dá para estudar?”",
        message: "Which exams and goals can I study for?",
      }),
    },
  ];

  return (
    <section aria-labelledby={TITLE_ID}>
      <div
        className={cn(
          PUBLIC_CONTAINER_CLASS,
          "grid grid-cols-1 gap-8 py-22 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-20 lg:py-34",
        )}
      >
        <div>
          <h2
            className="text-[clamp(2rem,4.2vw,3.125rem)] leading-[1.04] font-[670] tracking-[-0.045em] text-balance"
            id={TITLE_ID}
          >
            {t("Frequently asked questions")}
          </h2>
          <p className="text-muted-foreground mt-3.5">
            {t.rich("Still have questions? Write to <email></email>.", { email: emailLink(email) })}
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
