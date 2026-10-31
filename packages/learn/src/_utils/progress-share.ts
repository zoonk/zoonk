const WHOLE_PERCENT = 0.01;

/** Honest at its ends: begun reads "<1%", never "0%", and nearly done ">99%", never "100%". */
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
