import { type FirstChoiceScreen, FirstQuestion } from "@/components/catalog/first-question";
import { NoSessionNote } from "@/components/public/no-account-note";
import { StartBlock, StartLink } from "@/components/public/public-start";
import { StartLessonButton } from "@/components/public/start-lesson-button";
import { getAppLocale } from "@/i18n/locale";
import { withOrigin } from "@/lib/public/public-hrefs";
import { type PublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { getSentenceSpace } from "@zoonk/utils/locale";
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
  const space = getSentenceSpace(await getAppLocale());
  const startHref = withOrigin(playerPath, origin);

  const note = (
    <>
      {t("{minutes, plural, one {# minute} other {# minutes}}.", { minutes })}
      {space}
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
        <RichTextBlocks
          className="mb-6 text-[1.0625rem] leading-relaxed text-pretty sm:text-lg"
          text={screen.text}
        />

        <StartBlock className="mt-0 sm:mt-0" note={note}>
          <StartLink href={startHref}>{t("Start the lesson")}</StartLink>
        </StartBlock>
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
      <StartLessonButton lessonId={lessonId} origin={origin}>
        {t("Start this lesson")}
      </StartLessonButton>
    </StartBlock>
  );
}
