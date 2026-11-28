package com.zoonk.android.feature.activities.code

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityPhase
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * A run on our servers still lands, once, when the window changes width both ways while it runs; one that lands after the
 * learner left the step shows nothing when they come back.
 */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class CodeRunnerWindowTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    private lateinit var scenario: ActivityScenario<CodeRunnerWindowActivity>

    @After
    fun close() = scenario.close()

    @Test
    fun aRunLandsWhenTheWindowWidensAndNarrowsWhileItRuns() {
        val held = startARun()

        RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
        scenario.recreate()
        RuntimeEnvironment.setQualifiers("w411dp-h891dp")
        scenario.recreate()
        held.complete(Unit)
        rule.waitForIdle()

        rule.onNodeWithText("4950").assertExists()
        assertEquals(ScriptedCodeRuns.RUN_ID, CodeRunnerWindow.answer.runId)
        assertEquals(1, CodeRunnerWindow.runs.requests.size)
    }

    @Test
    fun aRunThatLandsAfterTheLearnerLeftShowsNothingOnReturn() {
        val held = startARun()

        CodeRunnerWindow.visible = false
        rule.waitForIdle()
        held.complete(Unit)
        rule.waitForIdle()
        CodeRunnerWindow.visible = true
        rule.waitForIdle()

        rule.onNodeWithText("4950").assertDoesNotExist()
        rule.onNodeWithText("Run").assertIsEnabled()
        assertNull(CodeRunnerWindow.answer)
    }

    /** A Java step whose Run is out, its end held until the returned call completes. */
    private fun startARun(): CompletableDeferred<Unit> {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = CodeRunnerWindowActivity::class.java.name
                packageName = application.packageName
            },
        )
        val held = CompletableDeferred<Unit>()
        CodeRunnerWindow.visible = true
        CodeRunnerWindow.answer = null
        CodeRunnerWindow.runs = ScriptedCodeRuns(listOf(ScriptedCodeRuns.ended(ScriptedCodeRuns.printed("4950\n")))).apply { gate = held }
        CodeRunnerWindow.sandbox = CodeSandbox(openPage = { null }, scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        scenario = ActivityScenario.launch(CodeRunnerWindowActivity::class.java)
        rule.onNodeWithText("Run").performClick()
        rule.waitForIdle()
        return held
    }

    private val ActivityAnswer?.runId: String?
        get() = (this as? LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf9Value)?.value?.runId?.toString()
}

/** What outlives [CodeRunnerWindowActivity]'s recreations, as the app's container does. */
object CodeRunnerWindow {
    /** False while the learner is away from the step, its view models kept, as moving to another step keeps them. */
    var visible by mutableStateOf(true)
    lateinit var runs: ScriptedCodeRuns
    lateinit var sandbox: CodeSandbox
    var answer: ActivityAnswer? = null
}

class CodeRunnerWindowActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalCodeSandbox provides CodeRunnerWindow.sandbox, LocalCodeRuns provides CodeRunnerWindow.runs) {
                    if (CodeRunnerWindow.visible) {
                        codeRunnerRenderer.canvas(
                            ActivityProps(
                                JavaCodeRunner.content,
                                answer = null,
                                expected = null,
                                isCorrect = null,
                                phase = ActivityPhase.Answering,
                                isLocked = false,
                                onAnswerChange = { CodeRunnerWindow.answer = it },
                                stepId = "java",
                            ),
                        )
                    }
                }
            }
        }
    }
}
