package com.zoonk.android.feature.practice

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RunMeterTest {
    @get:Rule
    val rule = createComposeRule()

    @Test
    fun tellsTalkBackTheDoneCountItIsGiven() {
        show(done = 1)

        rule.onNode(progress).assert(
            SemanticsMatcher("one of three done") {
                it.config[SemanticsProperties.ProgressBarRangeInfo].current ==
                    1f
            },
        )
    }

    @Test
    fun keepsAStudyRunsProgressOnItsQuestionUntilContinue() {
        show()

        rule
            .onNode(
                progress,
            ).assert(SemanticsMatcher("none done yet") { it.config[SemanticsProperties.ProgressBarRangeInfo].current == 0f })
    }

    private val progress = SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo)

    private fun show(done: Int? = null) {
        val segments = listOf(Segment.Right, Segment.Ahead, Segment.Ahead)
        rule.setContent {
            ZoonkTheme {
                if (done == null) RunMeter(index = 0, total = 3, segments = segments) else RunMeter(0, 3, segments, done = done)
            }
        }
    }
}
