import defineEloqntConfig from "@zoonk/i18n/define-eloqnt-config";

/** @public */
export default defineEloqntConfig({
  messages: {
    format: { codec: "./.eloqnt/xcstrings.ts", extension: ".xcstrings" },
    path: "./Zoonk/Resources/Localization/{namespace}",
  },
  srcPath: null,
});
