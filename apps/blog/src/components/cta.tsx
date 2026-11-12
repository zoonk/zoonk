import { Buddy } from "@zoonk/ui/components/buddy";
import { buttonVariants } from "@zoonk/ui/components/button";

const START_CTA = {
  href: "https://www.zoonk.com/start",
  link: "Start free",
  note: "No account needed.",
  text: "Tell us in your own words and answer a few quick questions. You'll see your whole plan before you pay.",
  title: "What's your goal?",
};

export function StartCta() {
  return (
    <aside
      className="not-prose bg-background text-foreground -mx-6 my-12 flex flex-col items-center px-6 py-12 text-center md:rounded-2xl lg:-mx-28 dark:border-y md:dark:border"
      data-slot="ink-band"
    >
      <Buddy beltColor="white" className="size-20" energy={null} glasses="round" kind="zu" />
      <p className="mt-4 text-3xl font-semibold tracking-tight text-balance">{START_CTA.title}</p>
      <p className="text-muted-foreground mt-2 max-w-sm text-pretty">{START_CTA.text}</p>
      <a className={buttonVariants({ className: "mt-6", size: "lg" })} href={START_CTA.href}>
        {START_CTA.link}
      </a>
      <p className="text-muted-foreground mt-3 text-xs">{START_CTA.note}</p>
    </aside>
  );
}
