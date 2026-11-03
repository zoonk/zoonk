import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { KindIcon } from "@zoonk/learn/kind-tile";
import { cn } from "@zoonk/ui/lib/utils";
import { CalendarClockIcon, ListChecksIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { Zu } from "./zu";

const TITLE_ID = "every-plan-title";

const ICON_CLASS = "text-muted-foreground size-4.5";

function EveryPlanItem({ mark, name, text }: { mark: ReactNode; name: string; text: string }) {
  return (
    <li className="flex gap-4 border-t py-6 last:border-b md:nth-last-2:border-b xl:flex-col xl:gap-3.5 xl:border-b-0! xl:pt-7 xl:pb-0">
      <span className="flex h-5.75 w-6 shrink-0 items-center justify-center">{mark}</span>
      <div>
        <p className="text-[1.0625rem] leading-5.75 font-semibold tracking-[-0.015em] text-balance">
          {name}
        </p>
        <p className="text-muted-foreground mt-1 text-[0.9375rem] leading-5.75 text-pretty">
          {text}
        </p>
      </div>
    </li>
  );
}

export async function EveryPlan() {
  const t = await getExtracted();

  return (
    <section aria-labelledby={TITLE_ID} className="bg-ground">
      <div className={cn(PUBLIC_CONTAINER_CLASS, "py-26 lg:py-36")}>
        <h2 className="text-headline max-w-[14em]" id={TITLE_ID}>
          {t({
            description: "In Brazilian Portuguese: “Todo plano funciona assim”.",
            message: "Every plan works like this",
          })}
        </h2>

        <ul className="mt-10 grid md:grid-cols-2 md:gap-x-12 xl:mt-14 xl:grid-cols-4 xl:gap-x-8">
          <EveryPlanItem
            mark={<ListChecksIcon aria-hidden="true" className={ICON_CLASS} />}
            name={t({
              description: "In Brazilian Portuguese: “Começa pelo que você já sabe”.",
              message: "It starts from what you know",
            })}
            text={t({
              description:
                "In Brazilian Portuguese: “Umas perguntas rápidas, em cerca de 2 minutos, e o plano pula o que você já sabe.”",
              message:
                "A few quick questions, about 2 minutes, and your plan skips what you already know.",
            })}
          />
          <EveryPlanItem
            mark={<CalendarClockIcon aria-hidden="true" className={ICON_CLASS} />}
            name={t({
              description: "In Brazilian Portuguese: “Se faltar um dia, ele se ajusta”.",
              message: "Miss a day and it adjusts",
            })}
            text={t({
              description:
                "In Brazilian Portuguese: “O que ficou pendente vem primeiro no dia seguinte. Se alguma data mudar, o plano te avisa.”",
              message:
                "What's left comes first the next day. If a date changes, your plan tells you.",
            })}
          />
          <EveryPlanItem
            mark={<KindIcon className="size-4.5" kind="review" />}
            name={t({
              description: "In Brazilian Portuguese: “Traz de volta antes de você esquecer”.",
              message: "It brings things back before you forget",
            })}
            text={t({
              description:
                "In Brazilian Portuguese: “Revisões rápidas na hora certa, e cada erro volta para você praticar até acertar.”",
              message:
                "Quick reviews at the right time, and every mistake comes back for you to practice until you get it right.",
            })}
          />
          <EveryPlanItem
            mark={<Zu className="size-7" crop="face" />}
            name={t({
              description:
                "Zu is the study buddy's name. In Brazilian Portuguese: “Travou? Pergunte para Zu”.",
              message: "Stuck? Ask Zu",
            })}
            text={t({
              description:
                "Zu is the study buddy's name; the question is the one the learner is answering. In Brazilian Portuguese: “Zu, seu parceiro de estudos, explica ali mesmo na questão, do jeito mais simples que você precisar.”",
              message:
                "Zu, your study buddy, explains right there in the question, as simply as you need.",
            })}
          />
        </ul>
      </div>
    </section>
  );
}
