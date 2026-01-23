"use client";

import type { CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const VALID_THEMES = ["light", "dark", "system"] as const;
type ValidTheme = (typeof VALID_THEMES)[number];

function isValidTheme(theme: string): theme is ValidTheme {
  return VALID_THEMES.some((v) => v === theme);
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const validTheme: ValidTheme = isValidTheme(theme) ? theme : "system";
  const style: CSSPropertiesWithVariables = {
    "--border-radius": "var(--radius)",
    "--normal-bg": "var(--popover)",
    "--normal-border": "var(--border)",
    "--normal-text": "var(--popover-foreground)",
  };

  return (
    <Sonner
      className="toaster group"
      icons={{
        error: <OctagonXIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
        success: <CircleCheckIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
      }}
      style={style}
      theme={validTheme}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { toast } from "sonner";
export { Toaster };
