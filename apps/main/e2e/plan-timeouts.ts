/**
 * How long a change that plans again may take before the editor says what it did, under load:
 * every plan edit plans again. Only waits on the new plan use it; what a control shows at once
 * keeps the default wait.
 */
export const REPLAN_TIMEOUT_MS = 15_000;
