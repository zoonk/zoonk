"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedPreview } from "./motion-preview";

function ResolvedValue({ variable }: { variable: string }) {
  const element = useRef<HTMLElement>(null);
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    if (element.current) {
      const resolved = getComputedStyle(element.current).getPropertyValue(variable);
      setValue(resolved.replaceAll(/\s+/gu, " ").trim());
    }
  }, [variable]);

  return (
    <code className="text-muted-foreground font-mono text-xs break-all" ref={element}>
      {value ?? "…"}
    </code>
  );
}

export function TokenValue({ variable }: { variable: string }) {
  const reduced = useReducedPreview();
  return <ResolvedValue key={String(reduced)} variable={variable} />;
}
