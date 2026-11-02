package com.zoonk.lint

import com.android.tools.lint.checks.infrastructure.LintDetectorTest
import com.android.tools.lint.checks.infrastructure.TestLintTask
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue

class MaterialOutlinedButtonDetectorTest : LintDetectorTest() {
    override fun getDetector(): Detector = MaterialOutlinedButtonDetector()

    override fun getIssues(): List<Issue> = listOf(MaterialOutlinedButtonDetector.ISSUE)

    override fun lint(): TestLintTask = super.lint().allowMissingSdk()

    private val material =
        kotlin(
            """
        package androidx.compose.material3
        fun OutlinedButton(onClick: () -> Unit) {}
        fun OutlinedIconButton(onClick: () -> Unit) {}
        """,
        ).indented()

    private val shared =
        kotlin(
            "src/com/zoonk/android/ui/components/OutlinedButtons.kt",
            """
        package com.zoonk.android.ui.components
        fun OutlinedButton(onClick: () -> Unit) = androidx.compose.material3.OutlinedButton(onClick)
        fun OutlinedIconButton(onClick: () -> Unit) = androidx.compose.material3.OutlinedIconButton(onClick)
        """,
        ).indented()

    fun testMaterialsOutlinedButtonsAreReportedOutsideTheSharedOnes() {
        lint()
            .files(
                material,
                shared,
                kotlin(
                    """
                package test.pkg
                import androidx.compose.material3.OutlinedButton
                import androidx.compose.material3.OutlinedIconButton as MaterialIconButton
                fun Screen() {
                    OutlinedButton {}
                    MaterialIconButton {}
                    com.zoonk.android.ui.components.OutlinedButton {}
                }
                """,
                ).indented(),
            ).run()
            .expectErrorCount(2)
    }
}
