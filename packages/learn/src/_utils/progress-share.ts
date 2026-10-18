/** The least share a whole percentage shows: under half of it, a begun share would read "0%". */
const WHOLE_PERCENT = 0.01;

/**
 * A share of something done (a subject's lessons, a coverage bar's part), honest at its ends:
 * begun reads "<1%", never "0%" beside a bar that shows it begun, and nearly done reads ">99%",
 * never "100%" before all of it is. `formatShare` writes a whole percentage in the learner's
 * language.
 */
export function formatProgressShare({
  formatShare,
  share,
}: {
  formatShare: (share: number) => string;
  share: number;
}): string {
  if (share > 0 && share < WHOLE_PERCENT / 2) {
    return `<${formatShare(WHOLE_PERCENT)}`;
  }

  if (share < 1 && share >= 1 - WHOLE_PERCENT / 2) {
    return `>${formatShare(1 - WHOLE_PERCENT)}`;
  }

  return formatShare(share);
}
