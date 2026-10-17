/**
 * Fetches and reads the answer's body to its end, for a caller that only needs its status or
 * headers: a body left unread keeps the request open until it's aborted, and everything waiting
 * for the page's requests waits for it too. A body that fails to arrive rejects like the fetch.
 */
export async function fetchToEnd(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  await response.arrayBuffer();
  return response;
}
