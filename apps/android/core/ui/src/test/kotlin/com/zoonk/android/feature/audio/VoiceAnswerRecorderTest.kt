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
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.MutationResult
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.theme.ZoonkTheme
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
                if (shown) {
                    VoiceAnswerRecorder<Unit>(grade = { GradeOutcome.Failed }, onGraded = {}, navigator = rememberAppNavigator())
                }
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
        rule.onNodeWithText("Tap and say it out loud").assertIsDisplayed()
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
}
