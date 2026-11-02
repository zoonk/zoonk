import { describe, expect, it } from "vitest";
import { formatProgressShare } from "./progress-share";

const formatShare = (share: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, style: "percent" }).format(share);

const formatFrench = (share: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0, style: "percent" }).format(share);

describe(formatProgressShare, () => {
  it("says a begun share is under 1%, never 0% beside a bar that shows it", () => {
    expect(formatProgressShare({ formatShare, share: 0.003 })).toBe("<1%");
    expect(formatProgressShare({ formatShare, share: 0.0049 })).toBe("<1%");
  });

  it("keeps 0% for nothing begun and whole percentages in between", () => {
    expect(formatProgressShare({ formatShare, share: 0 })).toBe("0%");
    expect(formatProgressShare({ formatShare, share: 0.005 })).toBe("1%");
    expect(formatProgressShare({ formatShare, share: 0.12 })).toBe("12%");
    expect(formatProgressShare({ formatShare, share: 0.994 })).toBe("99%");
  });

  it("says a share nearly done is over 99%, never 100% before all of it is", () => {
    expect(formatProgressShare({ formatShare, share: 0.995 })).toBe(">99%");
    expect(formatProgressShare({ formatShare, share: 0.9999 })).toBe(">99%");
    expect(formatProgressShare({ formatShare, share: 1 })).toBe("100%");
  });

  it("writes the bound in the learner's language", () => {
    expect(formatProgressShare({ formatShare: formatFrench, share: 0.002 })).toBe(
      `<${formatFrench(0.01)}`,
    );
  });
});
