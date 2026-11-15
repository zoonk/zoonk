package com.zoonk.lint

import com.android.tools.lint.client.api.UElementHandler
import com.android.tools.lint.detector.api.Category
import com.android.tools.lint.detector.api.ConstantEvaluator
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Implementation
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import com.android.tools.lint.detector.api.Scope
import com.android.tools.lint.detector.api.Severity
import com.android.tools.lint.detector.api.SourceCodeScanner
import org.jetbrains.uast.UBinaryExpression
import org.jetbrains.uast.UCallExpression
import org.jetbrains.uast.UElement
import org.jetbrains.uast.UExpression
import org.jetbrains.uast.UPolyadicExpression

class CentralizedFormattingDetector :
    Detector(),
    SourceCodeScanner {
    override fun getApplicableUastTypes(): List<Class<out UElement>> =
        listOf(UCallExpression::class.java, UPolyadicExpression::class.java, UBinaryExpression::class.java)

    override fun createUastHandler(context: JavaContext): UElementHandler? {
        if (ALLOWED_FILES.any { context.file.invariantSeparatorsPath.endsWith(it) }) return null
        return object : UElementHandler() {
            override fun visitCallExpression(node: UCallExpression) {
                val method = node.resolve() ?: return
                val owner = method.containingClass?.qualifiedName ?: return
                val direct =
                    (owner in FORMATTERS && method.name !in setOf("parse", "parseObject")) ||
                        (owner == "android.text.format.DateFormat" && method.name != "is24HourFormat") ||
                        (owner == "android.text.format.DateUtils" && method.name in DATE_UTILS_METHODS)
                val duration =
                    method.name == "format" &&
                        (node.valueArguments + listOfNotNull(node.receiver)).any {
                            ConstantEvaluator.evaluateString(context, it, false)?.let(DURATION_PATTERN::containsMatchIn) == true
                        }
                val temporalArgument =
                    method.name == "format" &&
                        node.valueArguments.any {
                            it.getExpressionType()?.canonicalText == "java.time.format.DateTimeFormatter"
                        }
                val temporalReceiver = method.name == "format" && node.receiver?.getExpressionType()?.canonicalText in FORMATTERS
                if (direct || duration || temporalArgument || temporalReceiver) report(context, node)
            }

            override fun visitPolyadicExpression(node: UPolyadicExpression) {
                if (node.operands.size >= 2) checkDuration(context, node)
            }

            override fun visitBinaryExpression(node: UBinaryExpression) {
                checkDuration(context, node)
            }
        }
    }

    private fun checkDuration(
        context: JavaContext,
        node: UExpression,
    ) {
        if (node.uastParent is UPolyadicExpression || node.uastParent is UBinaryExpression) return
        if (node.getExpressionType()?.canonicalText != "java.lang.String") return
        val source = node.sourcePsi?.text ?: return
        if (listOf(DURATION_PATTERN, CLOCK_TEMPLATE, CONCATENATED_UNIT).any { it.containsMatchIn(source) }) report(context, node)
    }

    private fun report(
        context: JavaContext,
        node: UElement,
    ) {
        context.report(
            ISSUE,
            node,
            if (node is UCallExpression) {
                context.getCallLocation(node, includeReceiver = false, includeArguments = true)
            } else {
                context.getLocation(node)
            },
            "Use ui/format/Formatters.kt for dates and durations, or ui/format/Clock.kt for clocks",
        )
    }

    companion object {
        private val DATE_UTILS_METHODS = setOf("formatDateTime", "getRelativeTimeSpanString", "formatElapsedTime")
        private val ALLOWED_FILES =
            setOf(
                "/com/zoonk/android/ui/format/Formatters.kt",
                "/com/zoonk/android/ui/format/Clock.kt",
            )
        private val FORMATTERS =
            setOf(
                "java.time.format.DateTimeFormatter",
                "java.text.SimpleDateFormat",
                "java.text.DateFormat",
                "android.icu.text.SimpleDateFormat",
                "android.icu.text.DateFormat",
                "android.icu.text.DateIntervalFormat",
                "android.icu.text.MeasureFormat",
            )
        private const val DURATION_UNIT = "(?:h|hr|hrs|hours?|min|mins|minutes?|s|sec|secs|seconds?)"
        private val DURATION_PATTERN = Regex("""(?:\$\{[^}]+}|\$\w+\b|%[\d$.]*[dfs])\s*$DURATION_UNIT\b|%[\d$]*d:%[\d$]*d""")
        private val CONCATENATED_UNIT = Regex("""\+\s*"\s*$DURATION_UNIT\b""")
        private val CLOCK_TEMPLATE = Regex("""\$(?:hours?|minutes?|seconds?|h|m|s|\{(?:hours?|minutes?|seconds?)[^}]*}):\$""")

        val ISSUE: Issue =
            Issue.create(
                id = "CentralizedFormatting",
                briefDescription = "Date, time or duration formatting outside shared formatters",
                explanation = "Keep date, time and duration styles in shared formatters so screens use the same representation.",
                category = Category.CORRECTNESS,
                priority = 6,
                severity = Severity.ERROR,
                implementation = Implementation(CentralizedFormattingDetector::class.java, Scope.JAVA_FILE_SCOPE),
            )
    }
}
