/**
 * The iOS app's ID (team and bundle), production first, then the Debug build, which shares the
 * team and opens links too.
 */
const APP_IDS = ["CGXYKAQUT9.com.zoonk", "CGXYKAQUT9.com.zoonk.dev"];

/**
 * Tells iOS which links open in the app instead of the browser: a plan someone shared, in any
 * locale. Everything else stays on the web until the app has a place for it.
 */
export function GET() {
  return Response.json({
    applinks: {
      details: [
        { appIDs: APP_IDS, components: [{ "/": "/plan-link/*" }, { "/": "/*/plan-link/*" }] },
      ],
    },
  });
}
