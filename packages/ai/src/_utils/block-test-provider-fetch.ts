export const blockTestProviderFetch: typeof fetch = async () => {
  throw new Error("Direct provider calls are disabled during tests.");
};
