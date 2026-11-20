package com.zoonk.lint

import com.android.tools.lint.checks.infrastructure.LintDetectorTest
import com.android.tools.lint.checks.infrastructure.TestLintTask
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue

class LoadStateDetectorTest : LintDetectorTest() {
    override fun getDetector(): Detector = LoadStateDetector()

    override fun getIssues(): List<Issue> = listOf(LoadStateDetector.ISSUE)

    override fun lint(): TestLintTask = super.lint().allowMissingSdk()

    private val loadState =
        kotlin(
            """
            package com.zoonk.android.data
            sealed interface LoadState<out T> {
                data object Loading : LoadState<Nothing>
                data class Loaded<T>(val value: T) : LoadState<T>
                data class Failed(val error: String) : LoadState<Nothing>
            }
            """,
        ).indented()

    private fun screen(packageName: String) =
        kotlin(
            """
            package $packageName
            import com.zoonk.android.data.LoadState
            fun label(state: LoadState<String>): String =
                when (state) {
                    is LoadState.Loading -> "…"
                    is LoadState.Loaded -> state.value
                    is LoadState.Failed -> "Try again"
                }
            fun loaded(state: LoadState<String>): Boolean =
                when (state) {
                    is LoadState.Loaded -> true
                    else -> false
                }
            """,
        ).indented()

    fun testAScreenSwitchingOnFailedIsReported() {
        lint()
            .files(loadState, screen("test.pkg"))
            .issues(LoadStateDetector.ISSUE)
            .run()
            .expectErrorCount(1)
    }

    fun testTheDesignSystemDrawsTheStates() {
        lint()
            .files(loadState, screen("com.zoonk.android.ui.scaffold"))
            .issues(LoadStateDetector.ISSUE)
            .run()
            .expectClean()
    }
}
