const INTERRUPT_EXIT_CODE = 130;
const TERMINATION_EXIT_CODE = 143;

/** Keep the supervisor alive through pending child startup so cancellation still runs its cleanup. */
export async function withPrerenderCancellation(run: (signal: AbortSignal) => Promise<void>) {
  const controller = new AbortController();

  function interrupt() {
    controller.abort("SIGINT");
  }

  function terminate() {
    controller.abort("SIGTERM");
  }

  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);

  try {
    await run(controller.signal);
  } catch (error) {
    if (!controller.signal.aborted) {
      throw error;
    }

    process.stderr.write(`Prerender guard cancelled: ${String(controller.signal.reason)}\n`);
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);

    if (controller.signal.aborted) {
      process.exitCode =
        controller.signal.reason === "SIGINT" ? INTERRUPT_EXIT_CODE : TERMINATION_EXIT_CODE;
    }
  }
}
