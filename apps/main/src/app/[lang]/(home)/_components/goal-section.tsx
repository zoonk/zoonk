import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { type Subject, SubjectLabel } from "@zoonk/learn/subject-label";
import { type ReactNode } from "react";

export function GoalSection({
  children,
  label,
  lead,
  subject,
  title,
  titleId,
}: {
  children: ReactNode;
  label: string;
  lead: ReactNode;
  subject: Subject;
  title: string;
  titleId: string;
}) {
  return (
    <section aria-labelledby={titleId} className="pb-28 lg:pb-38" data-subject={subject}>
      <div className={PUBLIC_CONTAINER_CLASS}>
        <div
          aria-hidden="true"
          className="bg-border before:bg-subject relative h-px before:absolute before:-top-px before:left-0 before:h-0.75 before:w-18 before:rounded-[3px]"
        />

        <div className="pt-7 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-20 lg:pt-10">
          <div className="flex flex-col items-start">
            <SubjectLabel subject={subject}>{label}</SubjectLabel>
            <h2 className="text-headline mt-4 sm:text-[2.75rem] sm:leading-12" id={titleId}>
              {title}
            </h2>
            <p className="text-lead mt-4 max-w-[30em]">{lead}</p>
          </div>

          <div className="mt-9 min-w-0 lg:mt-0">{children}</div>
        </div>
      </div>
    </section>
  );
}
