/** A missed provider mock must fail before a request can spend credits. */
export const blockTestProviderFetch: typeof fetch = async () => {
  throw new Error("Direct provider calls are disabled during tests.");
};
