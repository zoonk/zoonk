package com.zoonk.android.feature.conversation

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.HeldRuns
import com.zoonk.android.data.writingWaits
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class CallWritingWindowTest {
    @get:Rule
    val compose = createEmptyComposeRule()

    private var scenario: ActivityScenario<CallWritingTestActivity>? = null

    @After
    fun close() {
        scenario?.close()
        CallWritingWindow.content = {}
    }

    @Test
    fun aPracticeWaitSurvivesRecreationAndOpensOnce() = practice(fails = false)

    @Test
    fun aPracticeWaitSurvivesRecreationAndShowsItsFailure() = practice(fails = true)

    private fun practice(fails: Boolean) {
        val runs = HeldRuns()
        val id = UUID.randomUUID()
        var starts = 0
        val model =
            CallStartModel(
                callStarter(runs) {
                    starts++
                    if (starts == 1) {
                        CallStart.Writing("run-1")
                    } else if (fails) {
                        CallStart.Failed
                    } else {
                        CallStart.Started(id)
                    }
                },
                GenerationKind.ConversationCall,
            )
        val opened = mutableListOf<UUID>()
        open { OpenStartedCall(model) { opened += it } }
        compose.runOnIdle { model.start(CallRequest.Practice(UUID.randomUUID(), null, 3)) }
        compose.waitForIdle()
        recreate()
        assertEquals(0, model.visit.number)
        assertEquals("run-1", model.writing.generationId.value)
        runs.write()
        compose.waitForIdle()
        assertEquals(2, starts)
        assertNull(model.writing.generationId.value)
        assertEquals(if (fails) emptyList() else listOf(id), opened)
        assertEquals(if (fails) CallStartModel.State.Failed else CallStartModel.State.Idle, model.state)
    }

    @Test
    fun aCheckpointWaitSurvivesRecreationAndOpensItsCall() = checkpoint(fails = false)

    @Test
    fun aCheckpointWaitSurvivesRecreationAndShowsItsFailure() = checkpoint(fails = true)

    private fun checkpoint(fails: Boolean) {
        val harness = ConversationHarness()
        val runs = HeldRuns()
        val sessions = FakeSession(AuthenticatedSession("ana", "token", "local"))
        val store = ConversationStore(harness.api, AppCache(sessions, harness.scope), writingWaits(runs, sessions))
        val model = CheckpointCallModel(UUID.randomUUID(), store)
        harness.api.writings += "run-1"
        open { CheckpointCallContent(model, harness.exits, {}, { _, _ -> Text("Conversation") }, {}) }
        compose.runOnIdle { model.start(null) }
        compose.waitForIdle()
        recreate()
        assertEquals(0, model.visit.number)
        assertEquals("run-1", model.writing.generationId.value)
        if (fails) harness.api.startRefusal = ApiException(ApiError.Network)
        runs.write()
        compose.waitForIdle()
        assertEquals(2, harness.api.starts.size)
        assertNull(model.writing.generationId.value)
        assertEquals(if (fails) null else OpenedCall(harness.id, null), model.opened)
        assertEquals(if (fails) CheckpointCallModel.Start.Failed else CheckpointCallModel.Start.Idle, model.start)
    }

    private fun open(content: @Composable () -> Unit) {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = CallWritingTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        CallWritingWindow.content = content
        scenario = ActivityScenario.launch(CallWritingTestActivity::class.java)
        compose.waitForIdle()
    }

    private fun recreate() {
        for (qualifiers in listOf("w1280dp-h900dp", "w411dp-h891dp")) {
            compose.waitForIdle()
            RuntimeEnvironment.setQualifiers(qualifiers)
            checkNotNull(scenario).recreate()
            compose.waitForIdle()
        }
    }
}

object CallWritingWindow {
    var content: @Composable () -> Unit = {}
}

class CallWritingTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ZoonkTheme { CallWritingWindow.content() } }
    }
}
