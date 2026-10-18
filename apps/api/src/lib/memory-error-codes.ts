/** Stable codes for the memory endpoints, so clients can recover without reading messages. */
export const memoryErrorCodes = {
  changeAlreadyUndone: "MEMORY_CHANGE_ALREADY_UNDONE",
  insightAlreadyAnswered: "MEMORY_INSIGHT_ALREADY_ANSWERED",
} as const;
