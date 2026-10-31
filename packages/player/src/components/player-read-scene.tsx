import { cn } from "@zoonk/ui/lib/utils";
import { PlayerRichText } from "./player-rich-text";
import { PlayerContentFrame } from "./step-layouts";

export function PlayerReadScene({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <PlayerContentFrame
      className={cn("relative flex flex-col items-start gap-6 pt-4 pb-6", className)}
      data-slot="player-read-scene"
    >
      {children}
    </PlayerContentFrame>
  );
}

export function PlayerReadSceneStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col gap-1 sm:gap-4", className)}
      data-slot="player-read-scene-stack"
    >
      {children}
    </div>
  );
}

export function PlayerReadSceneBody({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-lg leading-relaxed sm:text-xl sm:leading-relaxed"
      data-slot="player-read-scene-body"
    >
      {typeof children === "string" ? <PlayerRichText text={children} /> : children}
    </p>
  );
}
