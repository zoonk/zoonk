import { definePlugin } from "oxlint";
import noSingleUseTypeAlias from "./rules/no-single-use-type-alias.js";

export default definePlugin({
  meta: {
    name: "zoonk",
  },
  rules: {
    "no-single-use-type-alias": noSingleUseTypeAlias,
  },
});
