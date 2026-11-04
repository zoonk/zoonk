package com.zoonk.lint

import com.android.tools.lint.checks.infrastructure.LintDetectorTest
import com.android.tools.lint.checks.infrastructure.TestLintTask
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue

class MaterialComponentDetectorTest : LintDetectorTest() {
    override fun getDetector(): Detector = MaterialComponentDetector()

    override fun getIssues(): List<Issue> = listOf(MaterialComponentDetector.BUTTON, MaterialComponentDetector.TEXT_FIELD)

    override fun lint(): TestLintTask = super.lint().allowMissingSdk()

    private val material =
        kotlin(
            """
        package androidx.compose.material3
        fun Button(onClick: () -> Unit) {}
        fun TextButton(onClick: () -> Unit) {}
        fun OutlinedButton(onClick: () -> Unit) {}
        fun OutlinedIconButton(onClick: () -> Unit) {}
        fun FilledTonalButton(onClick: () -> Unit) {}
        fun ElevatedButton(onClick: () -> Unit) {}
        fun OutlinedTextField(value: String) {}
        fun TextField(value: String) {}
        """,
        ).indented()

    private val shared =
        kotlin(
            "src/com/zoonk/android/ui/components/Buttons.kt",
            """
        package com.zoonk.android.ui.components
        fun Button(onClick: () -> Unit) = androidx.compose.material3.Button(onClick)
        fun TextButton(onClick: () -> Unit) = androidx.compose.material3.TextButton(onClick)
        fun OutlinedButton(onClick: () -> Unit) = androidx.compose.material3.OutlinedButton(onClick)
        fun OutlinedIconButton(onClick: () -> Unit) = androidx.compose.material3.OutlinedIconButton(onClick)
        """,
        ).indented()

    private val fields =
        kotlin(
            "src/com/zoonk/android/ui/components/TextFields.kt",
            """
        package com.zoonk.android.ui.components
        fun OutlinedTextField(value: String) = androidx.compose.material3.OutlinedTextField(value)
        """,
        ).indented()

    fun testMaterialsButtonsAndFieldsAreReportedOutsideTheSharedOnes() {
        lint()
            .files(
                material,
                shared,
                fields,
                kotlin(
                    """
                package test.pkg
                import androidx.compose.material3.Button
                import androidx.compose.material3.TextButton
                import androidx.compose.material3.FilledTonalButton
                import androidx.compose.material3.ElevatedButton
                import androidx.compose.material3.OutlinedButton
                import androidx.compose.material3.OutlinedIconButton as MaterialIconButton
                import androidx.compose.material3.OutlinedTextField
                import androidx.compose.material3.TextField
                fun Screen() {
                    OutlinedTextField("")
                    TextField("")
                    com.zoonk.android.ui.components.OutlinedTextField("")
                    Button {}
                    TextButton {}
                    FilledTonalButton {}
                    ElevatedButton {}
                    OutlinedButton {}
                    MaterialIconButton {}
                    com.zoonk.android.ui.components.Button {}
                    com.zoonk.android.ui.components.TextButton {}
                    com.zoonk.android.ui.components.OutlinedButton {}
                }
                """,
                ).indented(),
            ).run()
            .expectErrorCount(8)
    }
}
