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

class MaterialWindowAdaptiveInfoDetector :
    Detector(),
    SourceCodeScanner {
    override fun getApplicableMethodNames(): List<String> =
        listOf("currentWindowAdaptiveInfo", "currentWindowAdaptiveInfoV2", "collectFoldingFeaturesAsState")

    override fun visitMethodCall(
        context: JavaContext,
        node: UCallExpression,
        method: PsiMethod,
    ) {
        if (!method.containingClass
                ?.qualifiedName
                .orEmpty()
                .startsWith("androidx.compose.material3.adaptive.")
        ) {
            return
        }

        context.report(
            ISSUE,
            node,
            context.getNameLocation(node),
            "Use `com.zoonk.android.ui.scaffold.windowAdaptiveInfo()`, which reads the window's folds once for every screen",
        )
    }

    companion object {
        val ISSUE: Issue =
            Issue.create(
                id = "MaterialWindowAdaptiveInfo",
                briefDescription = "Material's window reading instead of Zoonk's",
                explanation =
                    "Material's `currentWindowAdaptiveInfoV2()` starts reading the folds where it's called and sees " +
                        "none until that reading arrives, so a screen opened on an open book foldable shows one column " +
                        "before its two pages. `windowAdaptiveInfo()` reads them once for the window, under `ZoonkTheme`.",
                category = Category.CORRECTNESS,
                priority = 6,
                severity = Severity.ERROR,
                implementation = Implementation(MaterialWindowAdaptiveInfoDetector::class.java, Scope.JAVA_FILE_SCOPE),
            )
    }
}
