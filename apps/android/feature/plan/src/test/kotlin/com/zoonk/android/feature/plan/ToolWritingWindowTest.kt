package com.zoonk.android.feature.plan

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.shell.GoalSwitch
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.HeldRuns
import com.zoonk.android.data.writingWaits
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.PlanTool
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class ToolWritingWindowTest {
    @get:Rule
    val compose = createEmptyComposeRule()

    private var scenario: ActivityScenario<ToolWritingTestActivity>? = null

    @After
    fun close() {
        scenario?.close()
        ToolWritingWindow.content = {}
    }

    @Test
    fun aToolWaitSurvivesRecreationAndShowsItsAppliedChange() = tool(fails = false)

    @Test
    fun aToolWaitSurvivesRecreationAndShowsItsFailure() = tool(fails = true)

    private fun tool(fails: Boolean) {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = ToolWritingTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val api = FakePlanApi()
        val runs = HeldRuns(first = "writeSetupLessons", ready = "setupLessonsReady")
        val sessions = FakeSession(AuthenticatedSession("ana", "token", "local"))
        val cache = AppCache(sessions, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val model =
            PlanViewModel(
                PlanStore(api, cache),
                UUID.fromString(GOAL),
                writingWaits(runs, sessions),
                PlanNavigationModel(GoalSwitch { true }),
            )
        val draft = ToolDraft("Python", PlanTool.Choice.SETUP, PlanTool.System.MACOS)
        val tool = PlanTool(name = "Python", choice = null, system = null, later = false, essential = true)
        var closes = 0
        ToolWritingWindow.content = {
            VisitOf(model.visit)
            VisitOf(model.outcomes.editor)
            val answers by model.sheetAnswers.collectAsState()
            Column {
                ToolChoiceForm(
                    tool,
                    draft,
                    PlanEdits(
                        setupLessons = model.setupLessons,
                        outcomes = model.outcomes,
                        sheetAnswers = answers,
                    ),
                    {
                    },
                    { closes++ },
                )
            }
        }
        scenario = ActivityScenario.launch(ToolWritingTestActivity::class.java)
        compose.waitForIdle()
        api.setupWritings += "run-1"
        compose.runOnIdle {
            model.chooseTools(ToolAnswer(listOf("Python"), PlanTool.Choice.SETUP, PlanTool.System.MACOS), PlanAsker.Sheet(draft.opening))
        }
        compose.waitForIdle()
        for (qualifiers in listOf("w1280dp-h900dp", "w411dp-h891dp")) {
            compose.waitForIdle()
            RuntimeEnvironment.setQualifiers(qualifiers)
            checkNotNull(scenario).recreate()
            compose.waitForIdle()
        }
        assertEquals(0, model.outcomes.tools.number)
        assertEquals("run-1", model.setupLessons.generationId.value)
        if (fails) api.toolFailure = ApiException(ApiError.Network)
        runs.write()
        compose.waitForIdle()
        assertNull(model.setupLessons.generationId.value)
        if (fails) {
            assertTrue(PlanPart.Tools in model.failed)
            assertEquals(0, closes)
        } else {
            assertEquals(
                CHANGE_ID,
                model.latest.value
                    ?.change
                    ?.id
                    .toString(),
            )
            assertEquals(1, closes)
        }
    }
}

object ToolWritingWindow {
    var content: @Composable () -> Unit = {}
}

class ToolWritingTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ZoonkTheme { ToolWritingWindow.content() } }
    }
}
