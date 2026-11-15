package com.zoonk.android.feature.audio

import android.Manifest
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.Lifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.MutationResult
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf

@RunWith(AndroidJUnit4::class)
class VoiceAnswerRecorderTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aTakeStopsWhenTheRecorderLeavesTheScreenItsViewModelOutlives() {
        shadowOf(rule.activity.application).grantPermissions(Manifest.permission.RECORD_AUDIO)
        var shown by mutableStateOf(true)
        rule.setContent {
            ZoonkTheme {
                if (shown) VoiceAnswerRecorder(voiceAnswerModel(KEY) { GradeOutcome.Failed }, rememberAppNavigator())
            }
        }
        val record = rule.onNodeWithText("Record").fetchSemanticsNode().id
        rule.onNodeWithText("Record").performClick()
        // One button through both states, so TalkBack keeps its focus on it.
        assertEquals(record, rule.onNodeWithText("Stop").fetchSemanticsNode().id)

        shown = false
        rule.waitForIdle()
        shown = true

        rule.onNodeWithText("Record").assertIsDisplayed()
        rule.onNodeWithText("Tap Record and say it out loud").assertIsDisplayed()
    }

    /** The microphone turned off for good shows how to turn it on; back from Settings with it on, Record returns. */
    @Test
    fun theMicrophoneTurnedOnInSettingsBringsRecordBack() {
        lateinit var model: VoiceAnswerModel
        rule.setContent {
            ZoonkTheme {
                model = voiceAnswerModel(KEY) { GradeOutcome.Failed }
                VoiceAnswerRecorder(model, rememberAppNavigator())
            }
        }
        rule.runOnIdle { model.microphoneOff = true }
        rule.onNodeWithText("The microphone is off").assertIsDisplayed()
        rule.onNodeWithText("Record").assertDoesNotExist()

        shadowOf(rule.activity.application).grantPermissions(Manifest.permission.RECORD_AUDIO)
        rule.activityRule.scenario.moveToState(Lifecycle.State.STARTED)
        rule.activityRule.scenario.moveToState(Lifecycle.State.RESUMED)

        rule.onNodeWithText("Record").assertIsDisplayed()
        rule.onNodeWithText("The microphone is off").assertDoesNotExist()
    }

    @Test
    fun aGradingWriteSaysWhatTheRecorderShows() {
        fun refused(code: String) = MutationResult.Failed(ApiError.Unavailable, code, status = 429)
        assertEquals(GradeOutcome.Graded(1), MutationResult.Done(1).toGradeOutcome())
        assertEquals(GradeOutcome.NoSpeech, refused("NO_SPEECH").toGradeOutcome())
        assertEquals(GradeOutcome.Limited(Limit.SlowDown(60)), refused("SLOW_DOWN").toGradeOutcome())
        assertEquals(GradeOutcome.Failed, MutationResult.Failed(ApiError.Network).toGradeOutcome())
        assertEquals(GradeOutcome.Obsolete, MutationResult.Obsolete.toGradeOutcome())
    }

    /** The recorder leaves (another screen over it, the step left) while its take is graded, its view model kept. */
    @Test
    fun aTakeThatFailsAfterTheRecorderLeftSaysNothingOnReturn() {
        val graded = CompletableDeferred<GradeOutcome<Unit>>()
        var shown by mutableStateOf(true)
        lateinit var model: VoiceAnswerModel
        rule.setContent {
            ZoonkTheme {
                if (shown) {
                    model = voiceAnswerModel(KEY) { graded.await() }
                    VoiceAnswerRecorder(model, rememberAppNavigator())
                }
            }
        }
        rule.runOnIdle { model.check(VoiceRecording(ByteArray(8), 1_200)) }
        shown = false
        rule.waitForIdle()
        graded.complete(GradeOutcome.Failed)
        rule.waitForIdle()
        shown = true
        rule.waitForIdle()
        rule.onNodeWithText("We couldn't check your answer this time. Try again.").assertDoesNotExist()
    }

    /** A guest's limit offers an account; Login opens over the take, and back from it the notice is gone. */
    @Test
    fun aLimitWhoseSignUpOpensOverTheTakeIsGoneOnReturn() {
        lateinit var model: VoiceAnswerModel
        lateinit var navigator: AppNavigator
        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                if (navigator.currentRoute != AppRoute.Login) {
                    model = voiceAnswerModel(KEY) { GradeOutcome.Limited(Limit.SignUpRequired) }
                    VoiceAnswerRecorder(model, navigator)
                }
            }
        }
        rule.runOnIdle { model.check(VoiceRecording(ByteArray(8), 1_200)) }
        rule.onNodeWithText("Create a free account").performClick()
        rule.runOnIdle { navigator.back() }

        rule.onNodeWithText("Create a free account").assertDoesNotExist()
        rule.onNodeWithText("Tap Record and say it out loud").assertIsDisplayed()
    }

    private companion object {
        const val KEY = "microphone"
    }
}
