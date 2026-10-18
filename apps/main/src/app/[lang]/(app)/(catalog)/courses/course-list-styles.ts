/**
 * The courses as one flat list with hairlines between rows on phones and tablets, and as cards from
 * `lg`, beside the categories: as many columns as fit at 14rem or more each (two up to about
 * 1180px, three at 1280 to 1440, five at 1920, eight at 2560), so a wide screen shows more courses
 * instead of wider cards.
 */
export const COURSE_LIST_CLASS =
  "flex flex-col [&>li+li]:border-t lg:grid lg:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] lg:gap-3 lg:[&>li+li]:border-t-0";
