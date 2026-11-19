import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";
import { QuestionsHeading } from "./questions-heading";

/** Every public page's questions: the title and where to ask the rest beside the questions. */
export function PublicQuestions({ children, id }: { children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id}>
      <div
        className={cn(
          PUBLIC_CONTAINER_CLASS,
          "grid grid-cols-1 gap-8 py-26 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20 lg:py-36",
        )}
      >
        <div>
          <QuestionsHeading id={id} lineClassName="mt-3.5" titleClassName="text-headline" />
        </div>

        <div className="border-y">{children}</div>
      </div>
    </section>
  );
}
