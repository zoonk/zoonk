import { ZoonkLogo } from "@zoonk/ui/components/zoonk-logo";

/** The screens before Admin opens (signing in, an account that can't open it): one centered block. */
export function AdminGateScreen({
  action,
  children,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <ZoonkLogo className="size-10" />

      <div className="flex max-w-sm flex-col gap-1">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p aria-live="polite" className="text-muted-foreground text-sm text-pretty">
          {children}
        </p>
      </div>

      {action}
    </main>
  );
}
