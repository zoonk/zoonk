"use client";

import { createContext } from "react";

/**
 * Whether shortcuts belong to a dialog, sheet or drawer rather than to the screen under it.
 * Popups provide it, so a number key in a sheet's list picks there, and keys pressed in a sheet
 * never answer the screen below it.
 */
export const PopupShortcutLayer = createContext(false);
