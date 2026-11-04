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

class MaterialButtonDetector :
    Detector(),
    SourceCodeScanner {
    override fun getApplicableMethodNames(): List<String> = WRAPPED + SECONDARY

    override fun visitMethodCall(
        context: JavaContext,
        node: UCallExpression,
        method: PsiMethod,
    ) {
        val owner = method.containingClass?.qualifiedName.orEmpty()
        if (!owner.startsWith("androidx.compose.material3.") || context.file.name == SHARED_FILE) return

        val zoonk = if (method.name in SECONDARY) "OutlinedButton" else method.name
        context.report(ISSUE, node, context.getNameLocation(node), "Use `com.zoonk.android.ui.components.$zoonk`")
    }

    companion object {
        private const val SHARED_FILE = "Buttons.kt"
        private val WRAPPED = listOf("Button", "TextButton", "OutlinedButton", "OutlinedIconButton")
        private val SECONDARY = listOf("FilledTonalButton", "ElevatedButton")

        val ISSUE: Issue =
            Issue.create(
                id = "MaterialButton",
                briefDescription = "Material's button instead of Zoonk's",
                explanation =
                    "Zoonk's buttons in `ui/components/Buttons.kt` take main's corners and sizes instead of " +
                        "Material's pill, and one look per role: `Button` for the main action, `OutlinedButton` " +
                        "(an `input` line, ink words) for a secondary one, `TextButton` for a quiet one and " +
                        "`DestructiveButton`. Material's tonal and elevated buttons would be a second look for the secondary role.",
                category = Category.CORRECTNESS,
                priority = 6,
                severity = Severity.ERROR,
                implementation = Implementation(MaterialButtonDetector::class.java, Scope.JAVA_FILE_SCOPE),
            )
    }
}
