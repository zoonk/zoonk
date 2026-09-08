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
import com.intellij.psi.PsiMethod
import org.jetbrains.uast.UBinaryExpression
import org.jetbrains.uast.UBlockExpression
import org.jetbrains.uast.UCallExpression
import org.jetbrains.uast.UElement
import org.jetbrains.uast.UExpression
import org.jetbrains.uast.UExpressionList
import org.jetbrains.uast.UIfExpression
import org.jetbrains.uast.UParenthesizedExpression
import org.jetbrains.uast.UReferenceExpression
import org.jetbrains.uast.USwitchClauseExpressionWithBody
import org.jetbrains.uast.USwitchExpression
import org.jetbrains.uast.UYieldExpression
import org.jetbrains.uast.UastBinaryOperator

class HardcodedComposeTextDetector :
    Detector(),
    SourceCodeScanner {
    override fun getApplicableUastTypes(): List<Class<out UElement>> = listOf(UCallExpression::class.java, UBinaryExpression::class.java)

    override fun createUastHandler(context: JavaContext): UElementHandler =
        object : UElementHandler() {
            override fun visitCallExpression(node: UCallExpression) {
                val method = node.resolve() ?: return
                if (!isTextApi(method)) return

                for ((argument, parameter) in context.evaluator.computeArgumentMapping(node, method)) {
                    if (parameter.type.canonicalText in TEXT_TYPES) {
                        reportHardcodedText(context, argument)
                    }
                }
            }

            override fun visitBinaryExpression(node: UBinaryExpression) {
                if (node.operator != UastBinaryOperator.ASSIGN) return
                val method = (node.leftOperand as? UReferenceExpression)?.resolve() as? PsiMethod ?: return
                if (isSemanticsText(method)) reportHardcodedText(context, node.rightOperand)
            }
        }

    private fun isTextApi(method: PsiMethod): Boolean {
        val owner = method.containingClass?.qualifiedName.orEmpty()
        if (owner.startsWith("androidx.compose.animation.")) return false
        if (method.hasAnnotation("androidx.compose.runtime.Composable")) return true
        if (isSemanticsText(method)) return true
        return owner.startsWith("androidx.compose.ui.text.AnnotatedString") &&
            (method.isConstructor || method.name in setOf("append", "appendLine"))
    }

    private fun isSemanticsText(method: PsiMethod): Boolean =
        method.containingClass?.qualifiedName?.startsWith("androidx.compose.ui.semantics.") == true &&
            method.name != "setTestTag" && method.name != "getTestTag"

    private fun reportHardcodedText(
        context: JavaContext,
        expression: UExpression?,
    ) {
        // Inspect result branches only: conditions and case labels are not displayed text.
        when (expression) {
            null -> {
                return
            }

            is UParenthesizedExpression -> {
                reportHardcodedText(context, expression.expression)
            }

            is UIfExpression -> {
                reportHardcodedText(context, expression.thenExpression)
                reportHardcodedText(context, expression.elseExpression)
            }

            is USwitchExpression -> {
                expression.body.expressions.filterIsInstance<USwitchClauseExpressionWithBody>().forEach {
                    reportHardcodedText(context, it.body)
                }
            }

            is UBlockExpression -> {
                reportHardcodedText(context, expression.expressions.lastOrNull())
            }

            // Kotlin's Elvis operator is a synthetic expression list ending in an if expression.
            is UExpressionList -> {
                reportHardcodedText(context, expression.expressions.lastOrNull())
            }

            is UYieldExpression -> {
                reportHardcodedText(context, expression.expression)
            }

            else -> {
                reportConstantText(context, expression)
            }
        }
    }

    private fun reportConstantText(
        context: JavaContext,
        expression: UExpression,
    ) {
        val value = ConstantEvaluator().allowUnknowns().evaluate(expression) as? String ?: return
        if (value.none(Char::isLetter)) return
        context.report(
            ISSUE,
            expression,
            context.getLocation(expression),
            "Move user-facing text to res/values/strings.xml and use stringResource (or pluralStringResource).",
        )
    }

    companion object {
        private val TEXT_TYPES = setOf("java.lang.String", "java.lang.CharSequence")
        val ISSUE: Issue =
            Issue.create(
                id = "HardcodedComposeText",
                briefDescription = "Unlocalized Compose text",
                explanation = "User-facing Compose text must come from Android string resources.",
                category = Category.I18N,
                priority = 6,
                severity = Severity.ERROR,
                implementation = Implementation(HardcodedComposeTextDetector::class.java, Scope.JAVA_FILE_SCOPE),
            )
    }
}
