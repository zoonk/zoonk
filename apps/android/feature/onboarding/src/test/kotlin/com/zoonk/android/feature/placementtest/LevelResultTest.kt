package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguageLevelTestResult
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** What a language result says under its level rows: how many lessons it skipped, and the lesson that's next when there is one. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class LevelResultTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    @Test
    fun aResultThatSkippedLessonsSaysHowManyUnderItsLevelsAndNotAsASentence() {
        show(SKIPPED)

        rule.onNodeWithContentDescription("12 lessons skipped").assertIsDisplayed()
        rule.onNodeWithText("Skipped 12 lessons you already know.").assertDoesNotExist()
        rule.onNodeWithText("Up next").assertIsDisplayed()
    }

    @Test
    fun aResultWithNoNextLessonShowsNoUpNextRow() {
        show(NO_NEXT_LESSON)

        rule.onNodeWithText("Your Italian level").assertIsDisplayed()
        rule.onNodeWithText("Up next").assertDoesNotExist()
        rule.onNodeWithContentDescription("lessons skipped", substring = true).assertDoesNotExist()
        rule.onNodeWithText("Done").assertIsDisplayed()
    }

    private fun show(result: String) {
        rule.setContent {
            ZoonkTheme {
                Column {
                    SetupColumn {
                        LevelResult(
                            result = ApiJson.decodeFromString(LanguageLevelTestResult.serializer(), result),
                            targetLanguage = "it",
                            testOutLevel = null,
                            pressed = null,
                            failed = false,
                            action = "Done",
                            onAction = {},
                            onTestOut = {},
                        )
                    }
                }
            }
        }
    }

    private companion object {
        const val SKIPPED =
            """{"levels":[],"result":{"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","finishedAt":"2026-11-21T14:00:00Z",
             "lessonsSkipped":12,"levelsSkipped":["A1"],"ranges":{"reading":{"low":"B1","high":"B2"},"listening":{"low":"A2","high":"B1"}},
             "nextLesson":{"id":"1a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","title":"Ordering at a restaurant"}}}"""

        const val NO_NEXT_LESSON =
            """{"levels":[],"result":{"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","finishedAt":"2026-11-21T14:00:00Z",
             "lessonsSkipped":0,"levelsSkipped":[],"ranges":{"reading":{"low":"B1","high":"B2"},"listening":{"low":"A2","high":"B1"}},
             "nextLesson":null}}"""
    }
}
