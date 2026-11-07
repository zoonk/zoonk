import { getAndroidApps } from "@zoonk/utils/android-apps";

const HANDLE_ALL_URLS = "delegate_permission/common.handle_all_urls";

/**
 * The links that open in the native apps instead of the browser: a plan someone shared, in any
 * locale. Everything else stays on the web until the apps have a place for it. Apple's
 * `apple-app-site-association` and Android's `assetlinks.json` read paths the same way.
 */
export const APP_LINK_COMPONENTS = [{ "/": "/plan-link/*" }, { "/": "/*/plan-link/*" }];

/**
 * Apple sign-in's return on Android (the API's `/auth/apple/android` redirects there). The Auth Tab
 * catches it itself; a browser without Auth Tab hands it to the app as an App Link.
 */
const ANDROID_APPLE_RETURN = { "/": "/auth/apple" };

/**
 * Android's Digital Asset Links, verified by each app's signing fingerprints. An app without
 * fingerprints is left out. Android 15 and later open only these paths; earlier versions use the
 * app's manifest.
 */
export function getAndroidAssetLinks() {
  return getAndroidApps()
    .filter((app) => app.fingerprints.length > 0)
    .map((app) => ({
      relation: [HANDLE_ALL_URLS],
      relation_extensions: {
        [HANDLE_ALL_URLS]: {
          dynamic_app_link_components: [...APP_LINK_COMPONENTS, ANDROID_APPLE_RETURN],
        },
      },
      target: {
        namespace: "android_app",
        package_name: app.packageName,
        sha256_cert_fingerprints: app.fingerprints,
      },
    }));
}
