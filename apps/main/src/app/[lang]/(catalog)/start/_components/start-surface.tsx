import { Badge } from "@zoonk/ui/components/badge";

/**
 * Owns the shared page chrome for focused start-flow surfaces so each route
 * keeps the same width, vertical rhythm, and form-aligned presentation.
 */
export function StartSurface({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-8 p-4 pb-28 md:gap-10"
      data-slot="start-surface"
    >
      {children}
    </main>
  );
}

/**
 * Groups the optional status badge with the main page copy so every start
 * surface keeps the same spacing between status, title, and supporting text.
 */
export function StartSurfaceHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex w-full flex-col items-start gap-4 text-left"
      data-slot="start-surface-header"
    >
      {children}
    </div>
  );
}

/**
 * Keeps the heading and supporting copy visually connected while letting
 * surfaces omit the description without changing the surrounding layout.
 */
export function StartSurfaceContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col items-start gap-3" data-slot="start-surface-content">
      {children}
    </div>
  );
}

/**
 * Standardizes availability labels across start surfaces while still allowing
 * semantic badge variants such as destructive for blocked requests.
 */
export function StartSurfaceBadge({
  children,
  variant = "secondary",
}: {
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Badge>["variant"];
}) {
  return (
    <Badge data-slot="start-surface-badge" variant={variant}>
      {children}
    </Badge>
  );
}

/**
 * Uses one hero title scale for all focused start-flow pages so translations
 * and route-specific copy do not drift into separate visual systems.
 */
export function StartSurfaceTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className="text-3xl font-bold tracking-tight text-balance md:text-5xl"
      data-slot="start-surface-title"
    >
      {children}
    </h1>
  );
}

/**
 * Gives every start surface the same muted explanatory copy treatment so the
 * page title stays primary and the next action remains easy to scan.
 */
export function StartSurfaceDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-pretty" data-slot="start-surface-description">
      {children}
    </p>
  );
}

/**
 * Aligns terminal actions with the start-surface header and form content so
 * fallback states do not leave a single button floating in the center.
 */
export function StartSurfaceActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full items-start" data-slot="start-surface-actions">
      {children}
    </div>
  );
}
