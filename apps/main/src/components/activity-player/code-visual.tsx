"use client";

import {
  type SupportedVisualKind,
  type VisualContentByKind,
  codeVisualContentSchema,
} from "@zoonk/core/steps/visual-content-contract";
import { Fragment, useEffect, useState } from "react";
import { type BundledLanguage, type ThemedToken, codeToTokens } from "shiki";

type TokenLine = ThemedToken[];

function buildAnnotationMap(
  annotations:
    | {
        line: number;
        text: string;
      }[]
    | undefined,
): Map<number, string> {
  const map = new Map<number, string>();

  if (!annotations) {
    return map;
  }

  for (const annotation of annotations) {
    map.set(annotation.line, annotation.text);
  }

  return map;
}

function useHighlightedCode(code: string, language: string): TokenLine[] | null {
  const [tokens, setTokens] = useState<TokenLine[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    codeToTokens(code, {
      // oxlint-disable-next-line no-unsafe-type-assertion -- language comes from AI-generated content; unsupported languages are caught below
      lang: language as BundledLanguage,
      themes: { dark: "github-dark-dimmed", light: "github-light" },
    })
      .then((result) => {
        if (!cancelled) {
          setTokens(result.tokens);
        }
      })
      .catch(() => {
        // Unknown language or shiki error — stay on plain text fallback.
      });

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  return tokens;
}

function CodeLanguageLabel({ language }: { language: string }) {
  return (
    <span
      aria-hidden="true"
      className="text-muted-foreground/60 absolute top-3 right-3 font-mono text-xs tracking-wider uppercase select-none"
    >
      {language}
    </span>
  );
}

function CodeLine({ children, lineNumber }: { children: React.ReactNode; lineNumber: number }) {
  return (
    <div className="flex font-mono text-sm leading-relaxed whitespace-pre">
      <span
        aria-hidden="true"
        className="text-muted-foreground/40 w-8 shrink-0 pr-4 text-right select-none"
      >
        {lineNumber}
      </span>
      <code>{children}</code>
    </div>
  );
}

function CodeAnnotationLine({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-muted-foreground border-primary/20 my-1 ml-8 border-l-2 py-1 pl-3 font-sans text-xs whitespace-normal"
      role="note"
    >
      {children}
    </div>
  );
}

export function CodeVisual({ content }: { content: VisualContentByKind[SupportedVisualKind] }) {
  const parsed = codeVisualContentSchema.parse(content);
  const codeLines = parsed.code.split("\n");
  const tokens = useHighlightedCode(parsed.code, parsed.language);
  const annotationMap = buildAnnotationMap(parsed.annotations);

  return (
    <figure
      className="bg-muted relative w-full max-w-2xl overflow-x-auto rounded-xl p-4 sm:p-5"
      data-code-visual=""
    >
      <figcaption className="sr-only">{parsed.language}</figcaption>
      <CodeLanguageLabel language={parsed.language} />

      <div role="presentation">
        {codeLines.map((line, index) => {
          const lineNum = index + 1;
          return (
            <Fragment key={lineNum}>
              <CodeLine lineNumber={lineNum}>
                {tokens?.[index]
                  ? tokens[index].map((token) => (
                      <span key={token.offset} style={token.htmlStyle}>
                        {token.content}
                      </span>
                    ))
                  : line}
              </CodeLine>

              {annotationMap.has(lineNum) && (
                <CodeAnnotationLine>{annotationMap.get(lineNum)}</CodeAnnotationLine>
              )}
            </Fragment>
          );
        })}
      </div>
    </figure>
  );
}
