package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.language.translation
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** E 13.18: an answer to a screen a staff fix changed says why it doesn't count, and nothing else. */
@RunWith(AndroidJUnit4::class)
class UncheckedFeedbackTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun anAnswerToAnUpdatedScreenSaysWhyAndNothingElse() {
        val result = StepResult(isCorrect = false, checked = false, answerText = "Hola", feedback = "Because.")
        rule.setContent {
            ZoonkTheme { LessonStepResultView(translation("s"), result, ResultNext(savedMistake = false, willReturn = false), null) }
        }

        rule.onNodeWithText("Not checked this time").assertExists()
        rule.onNodeWithText("This question was updated after you started, so this answer doesn't count.").assertExists()
        assertTrue(rule.onAllNodesWithText("Because.", substring = true).fetchSemanticsNodes().isEmpty())
        assertTrue(rule.onAllNodesWithText("Right answer", substring = true).fetchSemanticsNodes().isEmpty())
    }
}
