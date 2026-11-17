package com.zoonk.android.feature.activities

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PatternTableCheckTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun aCorrectEndingIsNotCorrectedToAWordWithTwoStems() {
        show(ActivityFixtures.rightAnswer("patternTable"))

        compose.onNodeWithText("coméis").assertExists()
        compose.onNodeWithText("comen").assertExists()
    }

    @Test
    fun aWrongEndingShowsTheServersExpectedEndingWithOneStem() {
        show(assignmentAnswer(mapOf("4" to "en", "5" to "en")), correct = false)

        compose.onNodeWithText("comen  coméis").assertExists()
    }

    private fun show(
        answer: ActivityAnswer?,
        correct: Boolean = true,
    ) {
        compose.setContent {
            ZoonkTheme {
                patternTableRenderer.canvas(
                    ActivityProps(
                        content = ActivityFixtures.content("patternTable"),
                        answer = answer,
                        expected = ActivityFixtures.expected("patternTable"),
                        isCorrect = correct,
                        phase = ActivityPhase.Checked,
                        isLocked = true,
                        onAnswerChange = {},
                    ),
                )
            }
        }
    }
}
