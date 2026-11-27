/**
 * Saved lessons keeps its place in the frame while the learner is on it, as its bar does: a save
 * there reads the frame's places once they leave, and one that lands after they left reads them
 * at once.
 */
export function placesReadOnLeave(read: () => void) {
  let shown = false;
  let owed = false;

  return {
    leave: () => {
      shown = false;

      if (owed) {
        owed = false;
        read();
      }
    },
    saved: () => {
      if (shown) {
        owed = true;
      } else {
        read();
      }
    },
    show: () => {
      shown = true;
    },
  };
}
