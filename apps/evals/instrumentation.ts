export async function register() {
  // Imported here only: Next also builds this file for the edge runtime, which can't load it.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { zoonkDefaultProvider } = await import("@zoonk/core/ai");
    globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;
  }
}
