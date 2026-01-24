import { definePlugin } from "oxlint";
import noObjectParamsInCache from "./rules/no-object-params-in-cache.js";
import noSingleUseTypeAlias from "./rules/no-single-use-type-alias.js";

export default definePlugin({
  meta: {
    name: "zoonk",
  },
  rules: {
    "no-object-params-in-cache": noObjectParamsInCache,
    "no-single-use-type-alias": noSingleUseTypeAlias,
  },
});
