package com.zoonk.android.feature.audio

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/** A take graded while the window widens and narrows is graded once, and the recorder shown then says how it went. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class VoiceAnswerWindowTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    private lateinit var scenario: ActivityScenario<VoiceAnswerTestActivity>

    @After
    fun close() = scenario.close()

    @Test
    fun aTakeThatFailsWhileTheWindowWidensAndNarrowsIsGradedOnceAndSaysSo() {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = VoiceAnswerTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val graded = CompletableDeferred<GradeOutcome<Unit>>()
        VoiceAnswerWindow.gradings = 0
        VoiceAnswerWindow.graded = graded
        scenario = ActivityScenario.launch(VoiceAnswerTestActivity::class.java)
        rule.runOnIdle { VoiceAnswerWindow.model.check(VoiceRecording(ByteArray(8), 1_200)) }

        RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
        scenario.recreate()
        rule.waitForIdle()
        RuntimeEnvironment.setQualifiers("w411dp-h891dp")
        scenario.recreate()
        rule.waitForIdle()
        graded.complete(GradeOutcome.Failed)

        rule.onNodeWithText("We couldn't check your answer this time. Try again.").assertIsDisplayed()
        assertEquals(1, VoiceAnswerWindow.gradings)
    }
}

/** What outlives [VoiceAnswerTestActivity]'s recreations: the grading the test holds. */
object VoiceAnswerWindow {
    lateinit var graded: CompletableDeferred<GradeOutcome<Unit>>
    lateinit var model: VoiceAnswerModel
    var gradings = 0
}

class VoiceAnswerTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ZoonkTheme {
                VoiceAnswerWindow.model =
                    voiceAnswerModel("microphone") {
                        VoiceAnswerWindow.gradings++
                        VoiceAnswerWindow.graded.await()
                    }
                VoiceAnswerRecorder(VoiceAnswerWindow.model, rememberAppNavigator())
            }
        }
    }
}
