export function GET() {
  return new Response("User-Agent: *\nDisallow: /", {
    headers: { "Content-Type": "text/plain" },
  });
}
