/** Focus scrolls what it reaches clear of the bottom bar, its note and what the bar rests on. */
const CLEAR_OF_BAR_CLASS = "[&_*]:scroll-mb-[calc(var(--page-dock)+9rem)]";

export const TODAY_MAIN_CLASS = `flex flex-col ${CLEAR_OF_BAR_CLASS}`;

export const TODAY_ASIDE_CLASS = `sm:grid sm:grid-cols-2 sm:gap-x-10 sm:gap-y-8 min-[72rem]:flex min-[72rem]:gap-9 ${CLEAR_OF_BAR_CLASS}`;
