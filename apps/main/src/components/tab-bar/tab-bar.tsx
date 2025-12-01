"use client";

import { useScrollDirection } from "@zoonk/ui/hooks/use-scroll-direction";
import { cn } from "@zoonk/ui/lib/utils";

type TabBarProps = {
  children: React.ReactNode;
  /** Right action element (e.g., search button) */
  action?: React.ReactNode;
  className?: string;
};

/**
 * iOS 26-style pill tab bar that hides on scroll down and shows on scroll up.
 * Rendered at the bottom of the viewport with smooth show/hide animations.
 */
export function TabBar({ children, action, className }: TabBarProps) {
  const { scrollDirection, isAtTop } = useScrollDirection({ threshold: 10 });

  const isVisible = scrollDirection === "up" || isAtTop;

  return (
    <div
      aria-hidden={!isVisible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-300 ease-out",
        isVisible ? "translate-y-0" : "translate-y-full",
        className,
      )}
    >
      <nav className="flex items-center gap-1 rounded-full border border-border bg-background/80 p-1.5 shadow-lg backdrop-blur-md">
        {children}
      </nav>

      {action && (
        <div className="flex items-center rounded-full border border-border bg-background/80 p-1.5 shadow-lg backdrop-blur-md">
          {action}
        </div>
      )}
    </div>
  );
}
