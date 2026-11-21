import { Buddy } from "@zoonk/ui/components/buddy";
import { buttonVariants } from "@zoonk/ui/components/button";

/** The blog's one way in, in the header and at a post's end: the words every public page uses. */
export const START = { href: "https://www.zoonk.com/start", label: "Build my plan" } as const;

const START_CTA = {
  note: "Start free, no account needed.",
  text: "Tell us in your own words and answer a few quick questions. Then just follow each day's plan.",
  title: "What's your goal?",
};

export function StartCta() {
  return (
    <aside
      className="not-prose bg-background text-foreground -mx-4 my-12 flex flex-col items-center px-4 py-12 text-center sm:-mx-6 sm:px-6 md:rounded-xl lg:-mx-28 dark:border-y md:dark:border"
      data-slot="ink-band"
    >
      <Buddy beltColor="white" className="h-23" energy={null} glasses="round" kind="zu" />
      <p className="mt-4 text-3xl font-semibold tracking-tight text-balance">{START_CTA.title}</p>
      <p className="text-muted-foreground mt-2 max-w-sm">{START_CTA.text}</p>
      <a className={buttonVariants({ className: "mt-6", size: "lg" })} href={START.href}>
        {START.label}
      </a>
      <p className="text-muted-foreground mt-3 text-xs">{START_CTA.note}</p>
    </aside>
  );
}
