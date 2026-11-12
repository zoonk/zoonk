"use client";

import { useExtracted } from "next-intl";
import { DetailsDrawer } from "../_components/details-drawer";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
} from "../_components/list-group";

function useFacts(suggestsFocus: boolean) {
  const t = useExtracted();

  const focus = {
    line: t({
      description:
        "Under “Focusing never removes a subject”. “The ones” are exam subjects. “Your time” is the study time the learner has before the exam.",
      message: "The ones you need most get more time when your time can't cover everything.",
    }),
    title: t({
      description:
        "Title of a short fact about the Focus test. Say only this: giving some exam subjects more study time (focusing) is never what removes a subject from the study plan. Do not say that every subject stays in the plan or that no subject is left out: with very little study time a subject can still end up with no lessons. Use the same word for “focus” as “Change focus” and “Choose where to focus” do.",
      message: "Focusing never removes a subject",
    }),
  };

  return [
    {
      line: t("The test starts with the subjects that weigh most in your exam."),
      title: t({
        description:
          "Title of a short fact about the Focus test: its first questions are on the exam subjects that weigh most in the score.",
        message: "What counts most comes first",
      }),
    },
    {
      line: t({
        description:
          "“I don't know yet” is the button on every Focus test question; use the same words as that button.",
        message: "“I don't know yet” is a fine answer.",
      }),
      title: t({
        description: "Title of a short fact about the Focus test: it gives no grade or score.",
        message: "There's no grade",
      }),
    },
    {
      line: t({
        description:
          "Under “Stop anytime”: every Focus test answer is saved as soon as it is given.",
        message: "Each answer is saved.",
      }),
      title: t({
        description:
          "Title of a short fact about the Focus test: the learner can stop it whenever they want.",
        message: "Stop anytime",
      }),
    },
    ...(suggestsFocus ? [focus] : []),
    {
      line: t({
        description:
          "Under “A few more in your first week”. “These questions” are the Focus test's questions; “that” is the study sessions asking them.",
        message: "Your study sessions ask a few more of these questions. You can pause that.",
      }),
      title: t({
        description:
          "Title of a short fact about the Focus test: during the learner's first week, their study sessions ask a few more of its questions. “A few more” means questions.",
        message: "A few more in your first week",
      }),
    },
  ];
}

function FactRow({ fact }: { fact: { line: string; title: string } }) {
  return (
    <ListRow>
      <ListRowContent>
        <ListRowTitle>{fact.title}</ListRowTitle>
        <ListRowDescription className="text-pretty">{fact.line}</ListRowDescription>
      </ListRowContent>
    </ListRow>
  );
}

export function FocusTestHowItWorks({ suggestsFocus }: { suggestsFocus: boolean }) {
  const t = useExtracted();
  const facts = useFacts(suggestsFocus);
  const title = t("How it works");

  return (
    <DetailsDrawer label={title} title={title} trigger="link">
      <ListGroup>
        <ul>
          {facts.map((fact) => (
            <li key={fact.title}>
              <FactRow fact={fact} />
            </li>
          ))}
        </ul>
      </ListGroup>
    </DetailsDrawer>
  );
}
