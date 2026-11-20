/** The popup and backdrop hooks exported by the shared overlay pieces. */
export const OVERLAYS = [
  { backdrop: "dialog-overlay", panel: "dialog-content" },
  { backdrop: "drawer-backdrop", panel: "drawer-popup" },
  { backdrop: "side-panel-overlay", panel: "side-panel-content" },
  { backdrop: "alert-dialog-overlay", panel: "alert-dialog-content" },
];

export const OVERLAY_SELECTOR = OVERLAYS.map(({ panel }) => `[data-slot=${panel}]`).join(", ");
