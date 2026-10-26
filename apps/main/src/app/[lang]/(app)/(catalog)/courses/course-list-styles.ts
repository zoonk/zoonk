/**
 * The courses as one grid of cells divided by hairlines, as Linear and Vercel draw theirs: a list
 * on phones and tablets, and as many columns as fit at 15rem or more each from `lg` (three at
 * 1280 to 1440, five at 1920, seven at 2560), so a wide screen shows more courses instead of wider
 * cells. Each cell draws the hairlines on its top and left, and the frame hides the grid's outer
 * ones a pixel in, so only the lines between cells show, however many columns fit and however
 * full the last row is. The frame reaches past the page's edges by the cells' padding, so their
 * words sit on the page's edges.
 */
export const COURSE_GRID_FRAME_CLASS = "-mx-4 -mt-4 overflow-hidden sm:-mx-5 sm:-mt-5";

export const COURSE_GRID_CLASS =
  "-mt-px -ml-px grid grid-cols-1 lg:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]";

export const COURSE_CELL_CLASS = "min-w-0 border-t border-l";
