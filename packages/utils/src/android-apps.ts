/** A comma-separated list of fingerprints, so another key (the upload key, a second machine) can join. */
function readFingerprints(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((fingerprint) => fingerprint.trim())
    .filter(Boolean);
}

/**
 * The release app and the Debug build, each with the SHA-256 fingerprints (`AA:BB:…`, as `keytool`
 * prints them) of the certificates that sign it: Play App Signing's key for release, the local debug
 * keystore for Debug.
 */
export function getAndroidApps() {
  return [
    {
      fingerprints: readFingerprints(process.env.ANDROID_RELEASE_CERT_FINGERPRINTS),
      packageName: "com.zoonk",
    },
    {
      fingerprints: readFingerprints(process.env.ANDROID_DEBUG_CERT_FINGERPRINTS),
      packageName: "com.zoonk.debug",
    },
  ];
}
