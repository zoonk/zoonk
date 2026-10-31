import { getAndroidAssetLinks } from "@/lib/app-links";

/** Tells Android which apps may open this site's links (`getAndroidAssetLinks`). */
export function GET() {
  return Response.json(getAndroidAssetLinks());
}
