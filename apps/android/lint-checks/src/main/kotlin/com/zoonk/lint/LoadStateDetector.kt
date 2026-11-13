package com.zoonk.lint

import com.android.tools.lint.client.api.UElementHandler
import com.android.tools.lint.detector.api.Category
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Implementation
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import com.android.tools.lint.detector.api.Scope
import com.android.tools.lint.detector.api.Severity
import com.android.tools.lint.detector.api.SourceCodeScanner
import org.jetbrains.uast.UBinaryExpressionWithType
import org.jetbrains.uast.UElement
import org.jetbrains.uast.USwitchClauseExpression
import org.jetbrains.uast.USwitchExpression

/** A screen that draws its own failed state beside its loading and empty ones. */
class LoadStateDetector :
    Detector(),
    SourceCodeScanner {
    override fun getApplicableUastTypes(): List<Class<out UElement>> = listOf(USwitchExpression::class.java)

    override fun createUastHandler(context: JavaContext): UElementHandler =
        object : UElementHandler() {
            override fun visitSwitchExpression(node: USwitchExpression) {
                if (context.uastFile
                        ?.packageName
                        .orEmpty()
                        .startsWith(DESIGN_SYSTEM)
                ) {
                    return
                }
                val failed =
                    node.body.expressions
                        .filterIsInstance<USwitchClauseExpression>()
                        .flatMap { it.caseValues }
                        .filterIsInstance<UBinaryExpressionWithType>()
                        .firstOrNull { it.type.canonicalText == FAILED } ?: return
                context.report(ISSUE, failed, context.getLocation(failed), MESSAGE)
            }
        }

    companion object {
        private const val DESIGN_SYSTEM = "com.zoonk.android.ui."
        private const val FAILED = "com.zoonk.android.data.LoadState.Failed"
        private const val MESSAGE =
            "Show a page's loading, failed and empty states with `ResourceScaffold` (`core/designsystem`), " +
                "so every page says them the same way"

        val ISSUE: Issue =
            Issue.create(
                id = "HandDrawnLoadState",
                briefDescription = "A page's load states drawn by hand",
                explanation =
                    "Each page that switches on `LoadState` itself draws its own failed state, so the pages " +
                        "drift apart in what they say and how they retry. `ResourceScaffold` draws loading, " +
                        "failed and empty the one way and takes the loaded content.",
                category = Category.CORRECTNESS,
                priority = 6,
                severity = Severity.ERROR,
                implementation = Implementation(LoadStateDetector::class.java, Scope.JAVA_FILE_SCOPE),
                enabledByDefault = false,
            )
    }
}
