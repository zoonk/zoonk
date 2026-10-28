/** Next RSC fetches cannot follow cross-origin handoffs; 204 makes the router retry as a document navigation. */
export function getRouterPayloadFallback(request: Request): Response | null {
  return request.headers.get("rsc") === "1" ? new Response(null, { status: 204 }) : null;
}
