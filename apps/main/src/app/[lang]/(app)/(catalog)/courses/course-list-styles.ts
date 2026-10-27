/**
 * The courses as one grid of cells split by hairlines, as Linear and Vercel draw theirs: a list on
 * phones and tablets, and as many columns as fit at 15rem or more each from `lg` (three at 1280 to
 * 1440, five at 1920, seven at 2560), so a wide screen shows more courses instead of wider cells.
 * Rows read apart by rules only: a rule over the grid and one under each cell, which join across a
 * row since cells touch, and no lines between columns, so a short last row or a category of two
 * leaves no stray line. The frame reaches past the page's edges by the cells' padding, so their
 * words sit on the page's edges.
 */
export const COURSE_GRID_FRAME_CLASS = "-mx-4 sm:-mx-5";

export const COURSE_GRID_CLASS =
  "grid grid-cols-1 border-t lg:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]";

export const COURSE_CELL_CLASS = "min-w-0 border-b";
