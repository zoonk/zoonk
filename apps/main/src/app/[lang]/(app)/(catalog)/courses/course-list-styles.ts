/**
 * Reaches past the page's edges by the cells' padding, so their words sit on the page's edges: to
 * the screen's edges on a phone, and from `sm` as far as a highlighted row does (craft E7).
 */
export const COURSE_GRID_FRAME_CLASS = "-mx-4 sm:-mx-2.5";

export const COURSE_GRID_CLASS =
  "grid grid-cols-1 overflow-x-clip lg:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]";

export const COURSE_CELL_CLASS =
  "relative min-w-0 after:pointer-events-none after:absolute after:inset-x-4 after:bottom-0 after:border-b after:border-border sm:after:inset-x-2.5";
