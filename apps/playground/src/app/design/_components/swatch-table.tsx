"use client";

import { type ColorToken } from "@/design-system/color";
import { cn } from "@zoonk/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import { contrastRatio } from "./contrast";
import { renderCode } from "./doc";
import { useModeCss } from "./mode-styles";
import { MODES, modeClass } from "./modes";

/** WCAG's bars: 4.5:1 for words, 3:1 for a mark that carries meaning. */
const TEXT_MINIMUM = 4.5;
const MARK_MINIMUM = 3;

function measure(table: HTMLElement | null): Record<string, number> {
  const ratios: Record<string, number> = {};

  for (const sample of table?.querySelectorAll<HTMLElement>("[data-measure]") ?? []) {
    const cell = sample.closest<HTMLElement>("[data-mode]");
    const surface = sample.parentElement?.closest<HTMLElement>("[data-surface]");

    if (cell && surface) {
      const style = getComputedStyle(sample);

      ratios[`${sample.dataset.token}/${cell.dataset.mode}`] = contrastRatio({
        color: sample.dataset.measure === "text" ? style.color : style.backgroundColor,
        page: getComputedStyle(cell).backgroundColor,
        surface: getComputedStyle(surface).backgroundColor,
      });
    }
  }

  return ratios;
}

function Sample({ mode, token }: { mode: string; token: ColorToken }) {
  if (token.on) {
    return (
      <span
        className="ring-foreground/10 flex size-8 shrink-0 items-center justify-center rounded-md ring-1"
        data-surface
        style={{ backgroundColor: `var(--${token.on})` }}
      >
        <span
          className="text-sm font-semibold"
          data-measure="text"
          data-token={token.name}
          style={{ color: `var(--${token.name})` }}
        >
          Aa
        </span>
      </span>
    );
  }

  return (
    <>
      <span
        aria-label={`${token.name}, ${mode}`}
        className="ring-foreground/10 size-8 shrink-0 rounded-md ring-1"
        data-measure={token.text || token.tint ? undefined : "fill"}
        data-token={token.name}
        role="img"
        style={{ backgroundColor: `var(--${token.name})` }}
      />
      {token.text && (
        <span
          className="text-sm font-semibold"
          data-measure="text"
          data-token={token.name}
          style={{ color: `var(--${token.name})` }}
        >
          Aa
        </span>
      )}
    </>
  );
}

function Ratio({ ratio, text }: { ratio?: number; text?: boolean }) {
  if (ratio === undefined) {
    return <span className="text-faint font-mono text-[0.6875rem]">…</span>;
  }

  const minimum = text ? TEXT_MINIMUM : MARK_MINIMUM;

  return (
    <span
      className={cn(
        "font-mono text-[0.6875rem] tabular-nums",
        ratio >= minimum ? "text-muted-foreground" : "text-warning-text",
      )}
      title={`${text ? "As text" : "As a mark"}: ${minimum}:1 asked`}
    >
      {ratio.toFixed(2)}
    </span>
  );
}

export function SwatchTable({
  contrast = true,
  subject,
  tokens,
}: {
  contrast?: boolean;
  subject?: string;
  tokens: readonly ColorToken[];
}) {
  const table = useRef<HTMLDivElement>(null);
  const css = useModeCss();
  const [ratios, setRatios] = useState<Record<string, number>>({});

  useEffect(() => {
    if (css && contrast) {
      setRatios(measure(table.current));
    }
  }, [contrast, css]);

  return (
    <div className="flex flex-col" ref={table} role="table">
      <div
        className="text-faint hidden gap-3 pb-2 text-xs lg:grid lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))]"
        role="row"
      >
        <span role="columnheader">Token</span>
        {MODES.map((mode) => (
          <span key={mode.id} role="columnheader">
            {mode.label}
          </span>
        ))}
      </div>

      {tokens.map((token) => (
        <div
          className="border-border grid gap-3 border-t py-3 lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))]"
          key={token.name}
          role="row"
        >
          <div className="flex min-w-0 flex-col gap-1" role="rowheader">
            <code className="font-mono text-[0.8125rem] font-medium">{token.name}</code>
            <p className="text-sm">{token.meaning}</p>
            <p className="text-muted-foreground text-xs leading-relaxed">{renderCode(token.use)}</p>
            {token.avoid && (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Never: {renderCode(token.avoid)}
              </p>
            )}
          </div>

          {MODES.map((mode) => (
            <div
              className={cn(
                modeClass(mode.id),
                "ring-border flex min-h-16 items-center gap-3 rounded-lg px-3 py-2 ring-1",
              )}
              data-mode={mode.id}
              data-subject={subject}
              data-surface
              key={mode.id}
              role="cell"
            >
              <Sample mode={mode.label} token={token} />
              {contrast && !token.tint && (
                <Ratio ratio={ratios[`${token.name}/${mode.id}`]} text={token.text} />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
