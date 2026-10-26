import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe(cn, () => {
  it("keeps a color beside the app's label style, which sets the type", () => {
    expect(cn("text-label", "text-muted-foreground")).toBe("text-label text-muted-foreground");
  });

  it("replaces a type size with the app's title style, and the other way around", () => {
    expect(cn("text-lg", "text-title")).toBe("text-title");
    expect(cn("text-title", "text-sm")).toBe("text-sm");
  });

  it("treats the type roles as sizes and keeps a readout's face beside a size and a color", () => {
    expect(cn("text-section", "text-sm")).toBe("text-sm");
    expect(cn("text-lead", "text-foreground")).toBe("text-lead text-foreground");

    expect(cn("text-readout", "text-2xl", "text-muted-foreground")).toBe(
      "text-readout text-2xl text-muted-foreground",
    );
  });

  it("treats the option radius and the column widths as their kind's values", () => {
    expect(cn("rounded-xl", "rounded-option")).toBe("rounded-option");
    expect(cn("max-w-column", "max-w-none")).toBe("max-w-none");
    expect(cn("max-w-150", "lg:max-w-page")).toBe("max-w-150 lg:max-w-page");
  });
});
