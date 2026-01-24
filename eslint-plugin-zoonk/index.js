const noSingleUseTypeAlias = require("./rules/no-single-use-type-alias");

module.exports = {
  meta: {
    name: "zoonk",
  },
  rules: {
    "no-single-use-type-alias": noSingleUseTypeAlias,
  },
};
