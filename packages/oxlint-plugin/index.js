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
import oneBackLink from "./rules/one-back-link.js";
import oneEyebrow from "./rules/one-eyebrow.js";
import oneGlyphButton from "./rules/one-glyph-button.js";
import oneOverlayPiece from "./rules/one-overlay-piece.js";
import oneQuestionActionBar from "./rules/one-question-action-bar.js";
import oneQuestionTitle from "./rules/one-question-title.js";
import paddingAroundMultilineStatements from "./rules/padding-around-multiline-statements.js";
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
    "one-overlay-piece": oneOverlayPiece,
    "no-object-params-in-cache": noObjectParamsInCache,
    "no-t-function-as-argument": noTFunctionAsArgument,
    "no-uncaught-transition-await": noUncaughtTransitionAwait,
    "one-answer-option": oneAnswerOption,
    "one-back-link": oneBackLink,
    "one-glyph-button": oneGlyphButton,
    "one-question-action-bar": oneQuestionActionBar,
    "one-question-title": oneQuestionTitle,
    "padding-around-multiline-statements": paddingAroundMultilineStatements,
    "tailwind-canonical-classes": tailwindCanonicalClasses,
  },
});
