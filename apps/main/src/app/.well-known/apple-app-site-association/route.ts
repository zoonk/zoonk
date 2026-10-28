const APP_IDS = ["CGXYKAQUT9.com.zoonk", "CGXYKAQUT9.com.zoonk.dev"];

export function GET() {
  return Response.json({
    applinks: {
      details: [
        { appIDs: APP_IDS, components: [{ "/": "/plan-link/*" }, { "/": "/*/plan-link/*" }] },
      ],
    },
  });
}
