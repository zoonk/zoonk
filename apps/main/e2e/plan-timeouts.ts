/**
 * How long a change that plans again may take before the editor says what it did, under load.
 * Temporary: it covers the known cost of planning again on every plan edit (tracked as
 * canonical-main-e2e-plan-editor-timing-reds-214f), and the production-build perf pass lowers it
 * once that cost is cut. Only waits on the new plan use it; what a control shows at once keeps the
 * default wait.
 */
export const REPLAN_TIMEOUT_MS = 15_000;
