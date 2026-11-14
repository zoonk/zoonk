import { eslintCompatPlugin } from "@oxlint/plugins";
import noDynamicTranslationKey from "./rules/no-dynamic-translation-key.js";
import noGetExtractedInPromise from "./rules/no-get-extracted-in-promise.js";
import noHandMadeFold from "./rules/no-hand-made-fold.js";
import noHandPlacedIconButton from "./rules/no-hand-placed-icon-button.js";
import noHardcodedAriaLabel from "./rules/no-hardcoded-aria-label.js";
import noObjectParamsInCache from "./rules/no-object-params-in-cache.js";
import noPageTopSpacing from "./rules/no-page-top-spacing.js";
import noPlusBadge from "./rules/no-plus-badge.js";
import noTFunctionAsArgument from "./rules/no-t-function-as-argument.js";
import noUncaughtTransitionAwait from "./rules/no-uncaught-transition-await.js";
import oneAnswerOption from "./rules/one-answer-option.js";
import oneEyebrow from "./rules/one-eyebrow.js";
import oneGlyphButton from "./rules/one-glyph-button.js";
import oneQuestionActionBar from "./rules/one-question-action-bar.js";
import paddingAroundMultilineStatements from "./rules/padding-around-multiline-statements.js";
import shortcutKeys from "./rules/shortcut-keys.js";
import tailwindCanonicalClasses from "./rules/tailwind-canonical-classes.js";

/** @public */
export default eslintCompatPlugin({
  meta: { name: "zoonk" },
  rules: {
    "no-dynamic-translation-key": noDynamicTranslationKey,
    "no-get-extracted-in-promise": noGetExtractedInPromise,
    "no-hand-made-fold": noHandMadeFold,
    "no-hand-placed-icon-button": noHandPlacedIconButton,
    "no-hardcoded-aria-label": noHardcodedAriaLabel,
    "no-page-top-spacing": noPageTopSpacing,
    "no-plus-badge": noPlusBadge,
    "one-eyebrow": oneEyebrow,
    "no-object-params-in-cache": noObjectParamsInCache,
    "no-t-function-as-argument": noTFunctionAsArgument,
    "no-uncaught-transition-await": noUncaughtTransitionAwait,
    "one-answer-option": oneAnswerOption,
    "one-glyph-button": oneGlyphButton,
    "one-question-action-bar": oneQuestionActionBar,
    "shortcut-keys": shortcutKeys,
    "padding-around-multiline-statements": paddingAroundMultilineStatements,
    "tailwind-canonical-classes": tailwindCanonicalClasses,
  },
});
