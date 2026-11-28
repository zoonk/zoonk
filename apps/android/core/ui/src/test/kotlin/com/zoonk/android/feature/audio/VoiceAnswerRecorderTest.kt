package com.zoonk.android.feature.audio

import android.Manifest
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.R
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
    fun aRefusedMicrophoneStillAnswersAnotherWayAfterTheProcessIsReclaimed() {
        val handle = SavedStateHandle()
        VoiceAnswerModel(rule.activity, { GradeOutcome.Failed }, handle).blocked = true

        val restored =
            VoiceAnswerModel(
                rule.activity,
                { GradeOutcome.Failed },
                SavedStateHandle.createHandle(handle.savedStateProvider().saveState(), null),
            )

        assertEquals(true, restored.blocked)
    }

    @Test
    fun tappingRecordWithPermissionPendingReplacesTheIdleHint() {
        shadowOf(rule.activity.application).denyPermissions(Manifest.permission.RECORD_AUDIO)
        rule.setContent {
            ZoonkTheme { Recorder(voiceAnswerModel(KEY) { GradeOutcome.Failed }, rememberAppNavigator()) }
        }

        rule.onNodeWithText("Record").performClick()
        rule.onNodeWithText(IDLE_CUE, useUnmergedTree = true).assertDoesNotExist()
        rule.onNodeWithText("Stop").assertDoesNotExist()

        rule.runOnIdle {
            shadowOf(rule.activity.application).grantPermissions(Manifest.permission.RECORD_AUDIO)
            val request = shadowOf(rule.activity).lastRequestedPermission
            rule.activity.activityResultRegistry.dispatchResult(request.requestCode, true)
        }
        rule.waitUntilExactlyOneExists(hasText("Stop"))
    }

    @Test
    fun aTakeStopsWhenTheRecorderLeavesTheScreenItsViewModelOutlives() {
        shadowOf(rule.activity.application).grantPermissions(Manifest.permission.RECORD_AUDIO)
        var shown by mutableStateOf(true)
        rule.setContent {
            ZoonkTheme {
                if (shown) Recorder(voiceAnswerModel(KEY) { GradeOutcome.Failed }, rememberAppNavigator())
            }
        }
        val record = rule.onNodeWithText("Record").fetchSemanticsNode().id
        rule.onNodeWithText("Record").performClick()
        rule.waitUntilExactlyOneExists(hasText("Stop"))
        // One button through both states, so TalkBack keeps its focus on it.
        assertEquals(record, rule.onNodeWithText("Stop").fetchSemanticsNode().id)

        shown = false
        rule.waitForIdle()
        shown = true

        rule.onNodeWithText("Record").assertIsDisplayed()
        rule.onNodeWithText(IDLE_CUE, useUnmergedTree = true).assertIsDisplayed()
    }

    /** The microphone turned off for good shows how to turn it on; back from Settings with it on, Record returns. */
    @Test
    fun theMicrophoneTurnedOnInSettingsBringsRecordBack() {
        lateinit var model: VoiceAnswerModel
        rule.setContent {
            ZoonkTheme {
                model = voiceAnswerModel(KEY) { GradeOutcome.Failed }
                Recorder(model, rememberAppNavigator())
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
        assertEquals(GradeOutcome.MissedStart, refused("MISSED_START").toGradeOutcome())
        val slowed = refused("SLOW_DOWN").toGradeOutcome() as GradeOutcome.Limited
        assertEquals(60, (slowed.limit as Limit.SlowDown).retryAfterSeconds)
        assertEquals(GradeOutcome.Failed, MutationResult.Failed(ApiError.Network).toGradeOutcome())
        assertEquals(GradeOutcome.Obsolete, MutationResult.Obsolete.toGradeOutcome())
    }

    @Test
    fun takesOnTheSameVisitOmitStartupAfterAMissedStart() {
        val sent = mutableListOf<VoiceRecording>()
        var shown by mutableStateOf(true)
        lateinit var model: VoiceAnswerModel
        rule.setContent {
            ZoonkTheme {
                if (shown) {
                    model =
                        voiceAnswerModel(KEY) { recording ->
                            sent += recording
                            GradeOutcome.MissedStart
                        }
                    Recorder(model, rememberAppNavigator())
                }
            }
        }
        val first = VoiceRecording(ByteArray(8), 1_200, micStartupMs = 900)
        val retry = VoiceRecording(ByteArray(8), 1_200, micStartupMs = 900)
        rule.runOnIdle { model.check(first) }
        rule.onNodeWithText("We may have missed the start. Say it again.").assertIsDisplayed()
        rule.runOnIdle { model.check(retry) }
        rule.waitForIdle()

        shown = false
        rule.waitForIdle()
        shown = true
        rule.waitForIdle()
        val returned = VoiceRecording(ByteArray(8), 1_200, micStartupMs = 900)
        rule.runOnIdle { model.check(returned) }
        rule.waitForIdle()

        assertEquals(listOf(900L, null, 900L), sent.map { it.micStartupMs })
        assertEquals(listOf(first.attemptId, retry.attemptId, returned.attemptId), sent.map { it.attemptId })
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
                    Recorder(model, rememberAppNavigator())
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
                    Recorder(model, navigator)
                }
            }
        }
        rule.runOnIdle { model.check(VoiceRecording(ByteArray(8), 1_200)) }
        rule.onNodeWithText("Create a free account").performClick()
        rule.runOnIdle { navigator.back() }

        rule.onNodeWithText("Create a free account").assertDoesNotExist()
        rule.onNodeWithText(IDLE_CUE, useUnmergedTree = true).assertIsDisplayed()
    }

    private companion object {
        const val KEY = "microphone"
        const val IDLE_CUE = "Say it when “Speak now” appears"
    }
}

/** A screen's take as its pieces draw it: Record, the column's limit and the bar's note, or how to turn the microphone on. */
@Composable
internal fun Recorder(
    model: VoiceAnswerModel,
    navigator: AppNavigator,
) {
    if (model.microphoneOff) {
        MicrophoneOff(stringResource(R.string.pronunciation_microphone_off))
        return
    }
    Column {
        SpeakCue(model.recorder, model.checking)
        VoiceAnswerButton(model)
        VoiceAnswerLimit(model, navigator)
        recordNote(model)?.invoke()
    }
}
