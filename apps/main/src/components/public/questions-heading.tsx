import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { renderHelpLink } from "./public-disclosure";

/** Every public page's questions block opens the same way: its title, then where to ask the rest. */
export async function QuestionsHeading({
  id,
  lineClassName,
  titleClassName,
}: {
  id: string;
  lineClassName?: string;
  titleClassName?: string;
}) {
  const t = await getExtracted();

  return (
    <>
      <h2 className={titleClassName} id={id}>
        {t("Common questions")}
      </h2>
      <p className={cn("text-muted-foreground", lineClassName)}>
        {t.rich("Still have questions? <link>Ask us</link>.", { link: renderHelpLink })}
      </p>
    </>
  );
}
