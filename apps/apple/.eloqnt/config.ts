import defineEloqntConfig from "@zoonk/i18n/define-eloqnt-config";

/** @internal */
export default defineEloqntConfig({
  messages: {
    format: { codec: "@eloqnt/format-apple-xcstrings", extension: ".xcstrings" },
    path: "./Shared/Resources/Localization/{namespace}",
  },
  srcPath: null,
});
