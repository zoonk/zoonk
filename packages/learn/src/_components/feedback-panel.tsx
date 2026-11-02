import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, MinusIcon, XIcon } from "lucide-react";

export type FeedbackTone = "almost" | "neutral" | "right" | "wrong";

const TONE_CLASS: Readonly<Record<FeedbackTone, string>> = {
  almost: "text-warning-text",
  neutral: "text-foreground",
  right: "text-success-text",
  wrong: "text-destructive-text",
};

export function FeedbackPanel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "bg-card ring-border flex flex-col gap-2.5 rounded-xl p-4 ring-1 ring-inset",
        className,
      )}
      data-slot="feedback-panel"
      {...props}
    />
  );
}

function ToneGlyph({ tone }: { tone: FeedbackTone }) {
  if (tone === "right") {
    return <CheckIcon aria-hidden="true" className="size-4" />;
  }

  if (tone === "neutral") {
    return <MinusIcon aria-hidden="true" className="size-4" />;
  }

  return <XIcon aria-hidden="true" className="size-4" />;
}

export function FeedbackVerdict({
  children,
  className,
  end,
  icon,
  tone,
}: {
  children: React.ReactNode;
  className?: string;
  end?: React.ReactNode;
  icon?: React.ReactNode;
  tone: FeedbackTone;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <p
        className={cn(
          "flex items-start gap-2 text-[0.9375rem] leading-6 font-[550] [&_svg]:size-4",
          TONE_CLASS[tone],
        )}
        data-slot="feedback-verdict"
      >
        <LineMarker>{icon ?? <ToneGlyph tone={tone} />}</LineMarker>
        {children}
      </p>

      {end && (
        <LineMarker className="text-muted-foreground text-xs leading-6 font-medium tabular-nums">
          {end}
        </LineMarker>
      )}
    </div>
  );
}

export function FeedbackExplanation({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-foreground text-sm leading-relaxed", className)}
      data-slot="feedback-explanation"
      {...props}
    />
  );
}

export function FeedbackNote({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-xs leading-5", className)}
      data-slot="feedback-note"
      {...props}
    />
  );
}
