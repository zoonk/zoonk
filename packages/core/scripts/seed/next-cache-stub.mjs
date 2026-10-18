/**
 * `next/cache` for seed scripts that run core's server code outside Next (see `node-runtime.mjs`):
 * there's no request and no cache to tag or expire, as in core's Vitest setup. The app's own server
 * reads what the script wrote fresh.
 */
const nothing = () => null;

export async function io() {
  return null;
}

export {
  nothing as cacheLife,
  nothing as cacheTag,
  nothing as revalidatePath,
  nothing as revalidateTag,
};
