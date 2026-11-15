package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.StepState
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** The lead's ruling, as the web's: the API never names the step a run failed on, so a failed run draws no phases. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h900dp")
class GenerationWaitFailedTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aFailedRunShowsItsNoticeAndTryAgainAndNoPhases() {
        val run =
            GenerationRun(
                status = GenerationRun.Status.Failed,
                failure = GenerationFailure.Generation,
                steps = mapOf("planLesson" to StepState.Completed, "writeLesson" to StepState.Started),
            )
        compose.setContent { ZoonkTheme { GenerationWait(GenerationKind.Lesson, run, onRetry = {}) } }

        compose.onNodeWithText("Something went wrong on our side").assertExists()
        compose.onNodeWithText("Try again").assertExists()
        compose.onNodeWithText("Planning the lesson").assertDoesNotExist()
        compose.onNodeWithText("Writing the lesson").assertDoesNotExist()
    }

    @Test
    fun aLostConnectionKeepsItsPhases() {
        val run =
            GenerationRun(
                status = GenerationRun.Status.Failed,
                failure = GenerationFailure.Connection,
                steps = mapOf("planLesson" to StepState.Completed, "writeLesson" to StepState.Started),
            )
        compose.setContent { ZoonkTheme { GenerationWait(GenerationKind.Lesson, run, onRetry = {}) } }

        compose.onNodeWithText("Writing the lesson").assertExists()
    }
}
