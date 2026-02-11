import { definePlugin } from "oxlint";
import noDynamicTranslationKey from "./rules/no-dynamic-translation-key.js";
import noObjectParamsInCache from "./rules/no-object-params-in-cache.js";
import noSingleUseTypeAlias from "./rules/no-single-use-type-alias.js";
import noTFunctionAsArgument from "./rules/no-t-function-as-argument.js";

export default definePlugin({
  meta: {
    name: "zoonk",
  },
  rules: {
    "no-dynamic-translation-key": noDynamicTranslationKey,
    "no-object-params-in-cache": noObjectParamsInCache,
    "no-single-use-type-alias": noSingleUseTypeAlias,
    "no-t-function-as-argument": noTFunctionAsArgument,
  },
});
