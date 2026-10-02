import { Container, ContainerTitle } from "@zoonk/ui/components/container";
import { cn } from "@zoonk/ui/lib/utils";

/** Settings content aligns with the navigation's left edge and keeps a bounded reading width. */
export function SettingsPage({ children, className }: React.ComponentProps<"main">) {
  return <Container className={cn("max-w-150", className)}>{children}</Container>;
}

/** The page title, in Fun's display face when Fun is on. */
export function SettingsPageTitle({ children }: { children: React.ReactNode }) {
  return (
    <ContainerTitle className="in-data-[mode=fun]:font-fun-display text-2xl">
      {children}
    </ContainerTitle>
  );
}
