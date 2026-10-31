import { APP_LINK_COMPONENTS } from "@/lib/app-links";

const APP_IDS = ["CGXYKAQUT9.com.zoonk", "CGXYKAQUT9.com.zoonk.dev"];

export function GET() {
  return Response.json({
    applinks: { details: [{ appIDs: APP_IDS, components: APP_LINK_COMPONENTS }] },
  });
}
