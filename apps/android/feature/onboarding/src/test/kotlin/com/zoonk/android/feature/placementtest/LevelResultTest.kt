package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
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

/** A language result whose plan's first lesson isn't written yet names none. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class LevelResultTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    @Test
    fun aResultWithNoNextLessonShowsNoUpNextRow() {
        rule.setContent {
            ZoonkTheme {
                Column {
                    SetupColumn {
                        LevelResult(
                            result = ApiJson.decodeFromString(LanguageLevelTestResult.serializer(), NO_NEXT_LESSON),
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

        rule.onNodeWithText("Your Italian level").assertIsDisplayed()
        rule.onNodeWithText("Up next").assertDoesNotExist()
        rule.onNodeWithText("Done").assertIsDisplayed()
    }

    private companion object {
        const val NO_NEXT_LESSON =
            """{"levels":[],"result":{"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","finishedAt":"2026-11-21T14:00:00Z",
             "lessonsSkipped":0,"levelsSkipped":[],"ranges":{"reading":{"low":"B1","high":"B2"},"listening":{"low":"A2","high":"B1"}},
             "nextLesson":null}}"""
    }
}
