package com.zoonk.lint

import com.android.tools.lint.detector.api.Category
import com.android.tools.lint.detector.api.ConstantEvaluator
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Implementation
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import com.android.tools.lint.detector.api.Scope
import com.android.tools.lint.detector.api.Severity
import com.android.tools.lint.detector.api.SourceCodeScanner
import com.intellij.psi.PsiMethod
import org.jetbrains.uast.UCallExpression

/**
 * Lint's `DefaultLocale` reads the format string from a call's first argument, so it misses Kotlin's
 * `"%02d".format(hour)`, whose format string is the receiver.
 */
class ImplicitLocaleFormatDetector :
    Detector(),
    SourceCodeScanner {
    override fun getApplicableMethodNames(): List<String> = listOf("format")

    override fun visitMethodCall(
        context: JavaContext,
        node: UCallExpression,
        method: PsiMethod,
    ) {
        val receiverForm = method.parameterList.parametersCount == 2 && context.evaluator.parameterHasType(method, 0, "java.lang.String")
        if (!receiverForm || method.containingClass?.qualifiedName !in STRINGS_KT) return
        val format = node.receiver?.let { ConstantEvaluator.evaluateString(context, it, false) } ?: return
        if (CONVERSION.findAll(format).none { it.groupValues[1] in LOCALIZED }) return

        context.report(
            ISSUE,
            node,
            context.getCallLocation(node, includeReceiver = true, includeArguments = true),
            "Formats with the device's language, which can change its digits and capitals: pass `Locale.ROOT` or the shown locale",
        )
    }

    companion object {
        private val STRINGS_KT = setOf("kotlin.text.StringsKt", "kotlin.text.StringsKt__StringsJVMKt")

        /** `java.util.Formatter`'s specifier, capturing its conversion. */
        private val CONVERSION = Regex("""%(?:\d+\$)?[-#+ 0,(<]*\d*(?:\.\d+)?([a-zA-Z%])""")

        /** Conversions `Formatter` writes in the locale's digits, or capitalizes with its rules (Turkish `İ`). */
        private val LOCALIZED = setOf("d", "e", "E", "f", "g", "G", "t", "T", "S", "C")

        val ISSUE: Issue =
            Issue.create(
                id = "ImplicitLocaleFormat",
                briefDescription = "Kotlin `format` without a locale",
                explanation =
                    "`\"%02d:%02d\".format(8, 30)` formats with `Locale.getDefault()`, the device's language. On a " +
                        "device in Persian it writes `۰۸:۳۰`, which a server reading `HH:mm` refuses and which main " +
                        "never shows; on one in Turkish, `\"%S\".format(\"id\")` writes `İD`. Pass `Locale.ROOT` for " +
                        "data and fixed text (or use `java.time`'s ISO text), and format what learners read with the " +
                        "shown locale.",
                category = Category.CORRECTNESS,
                priority = 6,
                severity = Severity.ERROR,
                implementation = Implementation(ImplicitLocaleFormatDetector::class.java, Scope.JAVA_FILE_SCOPE),
            )
    }
}
