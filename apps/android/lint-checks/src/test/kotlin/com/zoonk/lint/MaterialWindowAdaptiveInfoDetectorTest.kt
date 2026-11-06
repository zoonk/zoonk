package com.zoonk.lint

import com.android.tools.lint.checks.infrastructure.LintDetectorTest
import com.android.tools.lint.checks.infrastructure.TestLintTask
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue

class MaterialWindowAdaptiveInfoDetectorTest : LintDetectorTest() {
    override fun getDetector(): Detector = MaterialWindowAdaptiveInfoDetector()

    override fun getIssues(): List<Issue> = listOf(MaterialWindowAdaptiveInfoDetector.ISSUE)

    override fun lint(): TestLintTask = super.lint().allowMissingSdk()

    fun testMaterialsWindowReadingsAreReported() {
        lint()
            .files(
                kotlin(
                    """
                package androidx.compose.material3.adaptive
                fun currentWindowAdaptiveInfo(): Any = Any()
                fun currentWindowAdaptiveInfoV2(): Any = Any()
                fun collectFoldingFeaturesAsState(): Any = Any()
                """,
                ).indented(),
                kotlin(
                    """
                package com.zoonk.android.ui.scaffold
                fun windowAdaptiveInfo(): Any = Any()
                """,
                ).indented(),
                kotlin(
                    """
                package test.pkg
                import androidx.compose.material3.adaptive.collectFoldingFeaturesAsState
                import androidx.compose.material3.adaptive.currentWindowAdaptiveInfo
                import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
                import com.zoonk.android.ui.scaffold.windowAdaptiveInfo
                fun Screen() {
                    currentWindowAdaptiveInfo()
                    currentWindowAdaptiveInfoV2()
                    collectFoldingFeaturesAsState()
                    windowAdaptiveInfo()
                }
                """,
                ).indented(),
            ).run()
            .expectErrorCount(3)
    }
}
