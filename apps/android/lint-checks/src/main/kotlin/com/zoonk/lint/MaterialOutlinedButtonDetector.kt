package com.zoonk.lint

import com.android.tools.lint.detector.api.Category
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Implementation
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import com.android.tools.lint.detector.api.Scope
import com.android.tools.lint.detector.api.Severity
import com.android.tools.lint.detector.api.SourceCodeScanner
import com.intellij.psi.PsiMethod
import org.jetbrains.uast.UCallExpression

class MaterialOutlinedButtonDetector :
    Detector(),
    SourceCodeScanner {
    override fun getApplicableMethodNames(): List<String> = listOf("OutlinedButton", "OutlinedIconButton")

    override fun visitMethodCall(
        context: JavaContext,
        node: UCallExpression,
        method: PsiMethod,
    ) {
        val owner = method.containingClass?.qualifiedName.orEmpty()
        if (!owner.startsWith("androidx.compose.material3.") || context.file.name == SHARED_FILE) return

        context.report(
            ISSUE,
            node,
            context.getNameLocation(node),
            "Use `com.zoonk.android.ui.components.${method.name}`, whose border is the input outline",
        )
    }

    companion object {
        private const val SHARED_FILE = "OutlinedButtons.kt"

        val ISSUE: Issue =
            Issue.create(
                id = "MaterialOutlinedButton",
                briefDescription = "Material's outlined button instead of Zoonk's",
                explanation =
                    "Material draws an outlined button's border in `outlineVariant`, the hairline border role, " +
                        "which nearly vanishes in dark theme. Zoonk's `OutlinedButton` and `OutlinedIconButton` in " +
                        "`ui/components` draw it in `outline`, as main's outline buttons use `--input`.",
                category = Category.CORRECTNESS,
                priority = 6,
                severity = Severity.ERROR,
                implementation = Implementation(MaterialOutlinedButtonDetector::class.java, Scope.JAVA_FILE_SCOPE),
            )
    }
}
