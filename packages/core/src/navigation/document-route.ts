/**
 * Routes that only redirect to another origin (sign-in's handoffs) have to run as a document load.
 * When Next's router opens one from a `<Link>` or a redirect, it asks for an RSC payload (the `RSC`
 * header) instead, and following the route's redirect from that fetch fails on the other origin
 * after running the route for nothing. This answers that fetch with an empty response, which makes
 * the router load the address as a document, so the route runs once, for the page.
 */
export function getRouterPayloadFallback(request: Request): Response | null {
  return request.headers.get("rsc") === "1" ? new Response(null, { status: 204 }) : null;
}
