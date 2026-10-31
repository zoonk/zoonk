import {
  type FirstChoiceScreen,
  FirstQuestion,
  StartNote,
} from "@/components/catalog/first-question";
import { NoSessionNote } from "@/components/public/no-account-note";
import { StartBlock, StartLink } from "@/components/public/public-start";
import { StartLessonButton } from "@/components/public/start-lesson-button";
import { withCatalogOrigin } from "@/lib/public/public-hrefs";
import { type PublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

function FirstScreenSection({ children }: { children: ReactNode }) {
  return <section className="mt-8 sm:mt-10">{children}</section>;
}

async function ChoiceScreen({
  lessonId,
  minutes,
  origin,
  playerPath,
  screen,
}: {
  lessonId: string;
  minutes: number;
  origin: string;
  playerPath: string;
  screen: FirstChoiceScreen;
}) {
  return (
    <FirstScreenSection>
      <FirstQuestion
        lessonId={lessonId}
        minutes={minutes}
        origin={origin}
        playerPath={playerPath}
        questionId={`lesson-first-question-${lessonId}`}
        screen={screen}
      />
    </FirstScreenSection>
  );
}

export async function LessonFirstScreen({
  lessonId,
  minutes,
  origin,
  playerPath,
  screen,
}: {
  lessonId: string;
  minutes: number;
  origin: string;
  playerPath: string;
  screen: PublicLibraryLesson["firstScreen"];
}) {
  const t = await getExtracted();
  const startHref = withCatalogOrigin(playerPath, origin);

  const note = (
    <>
      {t("{minutes, plural, one {# minute} other {# minutes}}.", { minutes })}{" "}
      <NoSessionNote>{t("No sign-up needed.")}</NoSessionNote>
    </>
  );

  if (screen?.kind === "choice") {
    return (
      <ChoiceScreen
        lessonId={lessonId}
        minutes={minutes}
        origin={origin}
        playerPath={playerPath}
        screen={screen}
      />
    );
  }

  if (screen?.kind === "text") {
    return (
      <FirstScreenSection>
        <p className="mb-6 text-lg leading-relaxed text-pretty sm:text-xl">{screen.text}</p>

        <StartLink className="w-full sm:w-auto" href={startHref}>
          {t("Start the lesson")}
        </StartLink>

        <StartNote>{note}</StartNote>
      </FirstScreenSection>
    );
  }

  if (screen) {
    return (
      <StartBlock note={note}>
        <StartLink href={startHref}>{t("Start the lesson")}</StartLink>
      </StartBlock>
    );
  }

  return (
    <StartBlock note={note}>
      <StartLessonButton action={playerPath} lessonId={lessonId} origin={origin}>
        {t("Start this lesson")}
      </StartLessonButton>
    </StartBlock>
  );
}
