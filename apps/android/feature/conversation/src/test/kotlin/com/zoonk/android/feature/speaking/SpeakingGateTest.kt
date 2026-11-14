package com.zoonk.android.feature.speaking

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.feature.conversation.CallStarter
import com.zoonk.android.feature.conversation.callStarter
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.SpeakingPaper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

/**
 * A locked task's Start turns into the gate, which keeps the task's Last result. The gate reads the
 * paper's access in [SpeakingStore], which a server refusal writes and a successful read replaces.
 */
@RunWith(AndroidJUnit4::class)
class SpeakingGateTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val goalId = UUID.randomUUID()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** What the server answers the next read of the paper with; it throws when the read fails. */
    private var answer: () -> SpeakingPaper = { paper("plusRequired") }
    private val store =
        SpeakingStore(
            { _, _ -> SpeakingRead.Paper(answer()) },
            AppCache(FakeSession(AuthenticatedSession("ana", "token", "local")), scope),
        )

    private fun show(start: CallStarter = callStarter { error("A locked task never starts a call") }) {
        rule.setContent {
            ZoonkTheme {
                val state by store.paper(goalId).collectShown()
                (state.value as? SpeakingRead.Paper)?.let {
                    SpeakingPaperSection(
                        paper = it.paper,
                        goalId = goalId,
                        openTask = "1",
                        start = start,
                        open = {},
                        openWeb = {},
                        onRefused = { store.refused(goalId) },
                    )
                }
            }
        }
        rule.onNodeWithText("Start").performClick()
    }

    /** A read of the paper after the server [answer]s, as a purchase or a pull to refresh starts one. */
    private fun readAgain(next: () -> SpeakingPaper) {
        answer = next
        rule.runOnIdle { scope.launch { store.paper(goalId).refresh() } }
        rule.waitForIdle()
    }

    private fun assertGate() {
        rule.onNodeWithText("Subscribe").assertExists()
        rule.onNodeWithText("Last result").assertExists()
        rule.onNodeWithText("Start").assertDoesNotExist()
    }

    private fun assertStart() {
        rule.onNodeWithText("Subscribe").assertDoesNotExist()
        rule.onNodeWithText("Start").assertExists()
        rule.onNodeWithText("Last result").assertExists()
    }

    @Test
    fun theGateKeepsLastResultAndAPurchaseLiftsIt() {
        show()
        assertGate()

        readAgain { paper("open") }

        assertStart()
    }

    /** The paper read open, then the subscription lapsed: the server's refusal is the gate, not a failure. */
    @Test
    fun aStartTheServerRefusesShowsTheGate() {
        answer = { paper("open") }
        show(
            callStarter {
                answer = { paper("plusRequired") }
                CallStart.PlusRequired
            },
        )

        assertGate()
    }

    /** Offline after the refusal: the paper can't be read again, and opening Subscribe and coming back changes nothing. */
    @Test
    fun aRefusalKeepsTheGateThroughAFailedReadAndALeftSubscription() {
        answer = { paper("open") }
        var starts = 0
        show(
            callStarter {
                starts++
                answer = { throw ApiException(ApiError.Network) }
                CallStart.PlusRequired
            },
        )
        assertGate()

        rule.onNodeWithText("Subscribe").performClick()
        readAgain { throw ApiException(ApiError.Network) }

        assertGate()
        assertEquals(1, starts)
    }

    /** A purchase made elsewhere: the paper reads open again, the same answer as before the refusal, and Start is back. */
    @Test
    fun aSuccessfulOpenReadAfterARefusalLiftsTheGate() {
        answer = { paper("open") }
        show(
            callStarter {
                answer = { throw ApiException(ApiError.Network) }
                CallStart.PlusRequired
            },
        )
        assertGate()

        readAgain { paper("open") }

        assertStart()
    }

    private fun paper(access: String): SpeakingPaper =
        ApiJson.decodeFromString(
            """
            {"exam":"dele","language":"es","level":"B2","paper":"oral","source":"https://example.com","title":"DELE B2",
             "access":"$access","minutes":{"min":15,"max":20},"prepMinutes":0,"prepTasks":[],
             "tasks":[{"key":"1","minutes":{"min":6,"max":7},"mode":"monologue","name":"Tarea 1","options":1,"prepMinutes":0,
               "prepShared":null,"role":"examiner","stimulus":"topic","criteria":[{"key":"fluency","name":"Fluidez"}],
               "lastTry":{"atLevel":1,"conversationId":"00000000-0000-4000-8000-0000000000c2","nearLevel":0,"rated":2}}]}
            """.trimIndent(),
        )
}
