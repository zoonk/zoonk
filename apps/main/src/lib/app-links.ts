const HANDLE_ALL_URLS = "delegate_permission/common.handle_all_urls";

/**
 * The links that open in the native apps instead of the browser: a plan someone shared, in any
 * locale. Everything else stays on the web until the apps have a place for it. Apple's
 * `apple-app-site-association` and Android's `assetlinks.json` read paths the same way.
 */
export const APP_LINK_COMPONENTS = [{ "/": "/plan-link/*" }, { "/": "/*/plan-link/*" }];

/** A comma-separated list of fingerprints, so another key (the upload key, a second machine) can join. */
function readFingerprints(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((fingerprint) => fingerprint.trim())
    .filter(Boolean);
}

/**
 * Android's Digital Asset Links: the release app and the Debug build, each verified by the SHA-256
 * fingerprints of the certificates that sign it (Play App Signing's key for release, the local
 * debug keystore for Debug). An app without fingerprints is left out. Android 15 and later open
 * only the paths in `APP_LINK_COMPONENTS`; earlier versions use the app's manifest.
 */
export function getAndroidAssetLinks() {
  const apps = [
    {
      fingerprints: readFingerprints(process.env.ANDROID_RELEASE_CERT_FINGERPRINTS),
      packageName: "com.zoonk",
    },
    {
      fingerprints: readFingerprints(process.env.ANDROID_DEBUG_CERT_FINGERPRINTS),
      packageName: "com.zoonk.debug",
    },
  ];

  return apps
    .filter((app) => app.fingerprints.length > 0)
    .map((app) => ({
      relation: [HANDLE_ALL_URLS],
      relation_extensions: {
        [HANDLE_ALL_URLS]: { dynamic_app_link_components: APP_LINK_COMPONENTS },
      },
      target: {
        namespace: "android_app",
        package_name: app.packageName,
        sha256_cert_fingerprints: app.fingerprints,
      },
    }));
}
