/**
 * Reaches past the page's edges by the cells' padding, so their words sit on the page's edges: to
 * the screen's edges on a phone, and from `sm` as far as a highlighted row does (craft E7).
 */
export const COURSE_GRID_FRAME_CLASS = "-mx-4 sm:-mx-2.5";

export const COURSE_GRID_CLASS =
  "grid grid-cols-1 overflow-x-clip border-t lg:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]";

/** The last cell carries its row's line on to the grid's end, so a short last row closes like the others. */
export const COURSE_CELL_CLASS =
  "relative min-w-0 border-b last:after:absolute last:after:top-full last:after:left-full last:after:w-screen last:after:border-b last:after:border-border";
