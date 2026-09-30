import { Container, ContainerTitle } from "@zoonk/ui/components/container";
import { cn } from "@zoonk/ui/lib/utils";

/** A settings page in the same centered column as the learning tabs. */
export function SettingsPage({ children, className }: React.ComponentProps<"main">) {
  return <Container className={cn("mx-auto max-w-150", className)}>{children}</Container>;
}

/** The page title, in Fun's display face when Fun is on. */
export function SettingsPageTitle({ children }: { children: React.ReactNode }) {
  return (
    <ContainerTitle className="in-data-[mode=fun]:font-fun-display text-2xl">
      {children}
    </ContainerTitle>
  );
}
