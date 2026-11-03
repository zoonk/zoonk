import { Buddy } from "@zoonk/ui/components/buddy";
import { buttonVariants } from "@zoonk/ui/components/button";

export function Cta({ children }: { children: React.ReactNode }) {
  return (
    <aside
      className="not-prose bg-background text-foreground -mx-6 my-12 flex flex-col items-center px-6 py-12 text-center md:rounded-2xl lg:-mx-28 dark:border-y md:dark:border"
      data-slot="ink-band"
    >
      <Buddy beltColor="white" className="size-20" energy={null} glasses="round" kind="zu" />
      {children}
    </aside>
  );
}

export function CtaTitle({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-3xl font-semibold tracking-tight text-balance">{children}</p>;
}

export function CtaText({ children }: { children: React.ReactNode }) {
  return <div className="text-muted-foreground mt-2 max-w-sm text-pretty">{children}</div>;
}

export function CtaLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <a className={buttonVariants({ className: "mt-6", size: "lg" })} href={href}>
      {children}
    </a>
  );
}

export function CtaNote({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground mt-3 text-xs">{children}</p>;
}
