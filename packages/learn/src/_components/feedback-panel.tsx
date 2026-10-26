import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, MinusIcon, XIcon } from "lucide-react";

/**
 * What an answer's verdict means, for its color and glyph: right (✓ blue), wrong (✕ pink-red),
 * almost (✕ amber), or neutral (a blank, a guess, an answer nothing checked) in the text color.
 * The verdict is words, so each takes its meaning's `-text` step.
 */
export type FeedbackTone = "almost" | "neutral" | "right" | "wrong";

const TONE_CLASS: Readonly<Record<FeedbackTone, string>> = {
  almost: "text-warning-text",
  neutral: "text-foreground",
  right: "text-success-text",
  wrong: "text-destructive-text",
};

/**
 * How an answer went, on one quiet panel under the question, the same in a lesson, a session, a
 * practice and a checkpoint: the verdict (`FeedbackVerdict`), one line on why
 * (`FeedbackExplanation`), the worked step that went wrong as a mono diff (`DiffLines`), and a
 * faint last line on what happens next (`FeedbackNote`). Only the verdict carries color; the panel
 * stays neutral, so the learner reads the why, not a red box.
 *
 * ```tsx
 * <FeedbackPanel>
 *   <FeedbackVerdict tone="wrong">Not quite</FeedbackVerdict>
 *   <FeedbackExplanation>The discount applies to the raised price.</FeedbackExplanation>
 *   <DiffLines labels={labels} lines={lines} />
 *   <FeedbackNote>Saved to your mistakes · back at the end of this lesson</FeedbackNote>
 * </FeedbackPanel>
 * ```
 */
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

/**
 * The verdict, as the panel's title: a plain ✓ or ✕ in its color and a few words ("Not quite"),
 * with room on the right for a quiet aside (`end`, such as "3 right in a row"). `icon` replaces
 * the glyph for a verdict of its own (a guess's sparkle).
 */
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

/** The one line on why, under the verdict. */
export function FeedbackExplanation({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-foreground text-sm leading-relaxed", className)}
      data-slot="feedback-explanation"
      {...props}
    />
  );
}

/**
 * The panel's faint last line: what happens next ("Saved to your mistakes · back at the end of
 * this lesson"), with nothing to do about it.
 */
export function FeedbackNote({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-xs leading-5", className)}
      data-slot="feedback-note"
      {...props}
    />
  );
}
