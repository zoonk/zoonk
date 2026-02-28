import { eslintCompatPlugin } from "@oxlint/plugins";
import noDynamicTranslationKey from "./rules/no-dynamic-translation-key.js";
import noGetExtractedInPromise from "./rules/no-get-extracted-in-promise.js";
import noHardcodedAriaLabel from "./rules/no-hardcoded-aria-label.js";
import noObjectParamsInCache from "./rules/no-object-params-in-cache.js";
import noSingleUseTypeAlias from "./rules/no-single-use-type-alias.js";
import noTFunctionAsArgument from "./rules/no-t-function-as-argument.js";

/** @public */
export default eslintCompatPlugin({
  meta: {
    name: "zoonk",
  },
  rules: {
    "no-dynamic-translation-key": noDynamicTranslationKey,
    "no-get-extracted-in-promise": noGetExtractedInPromise,
    "no-hardcoded-aria-label": noHardcodedAriaLabel,
    "no-object-params-in-cache": noObjectParamsInCache,
    "no-single-use-type-alias": noSingleUseTypeAlias,
    "no-t-function-as-argument": noTFunctionAsArgument,
  },
});
