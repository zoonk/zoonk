import defineEloqntConfig from "@zoonk/i18n/define-eloqnt-config";

/**
 * A String Catalog keeps every locale in one file, so `path` has no
 * `{locale}` placeholder and the inherited `locales: "infer"` reads them from
 * inside the catalogs. `{namespace}` matches each catalog by filename
 * (currently only `Navigation.xcstrings`), so new catalogs are picked up
 * without config changes. No `srcPath`: Xcode extracts strings from Swift
 * code into the catalogs, so there is no TypeScript source to scan.
 * @internal
 */
export default defineEloqntConfig({
  messages: {
    format: { codec: "@eloqnt/format-apple-xcstrings", extension: ".xcstrings" },
    path: "./Shared/Resources/Localization/{namespace}",
  },
  srcPath: null,
});
