package com.zoonk.android.feature.conversation

import android.Manifest
import android.app.Application
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.feature.audio.AudioOutput
import com.zoonk.android.feature.audio.PlaybackEnd
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.VoiceFiles
import com.zoonk.android.feature.livecall.CallReservation
import com.zoonk.android.feature.livecall.FakeCallClient
import com.zoonk.android.feature.livecall.FakeTransport
import com.zoonk.android.feature.livecall.LiveCall
import com.zoonk.android.feature.livecall.LiveServerEvent
import com.zoonk.android.feature.livecall.OngoingCalls
import com.zoonk.android.feature.livecall.characterSays
import com.zoonk.android.feature.livecall.learnerSays
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CompletedLanguageConversation
import com.zoonk.api.models.LanguageConversation
import com.zoonk.api.models.LanguageConversationCompletionInput
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf
import java.io.File
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class ConversationFlowTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val harness = ConversationHarness()
    private val api get() = harness.api
    private val client get() = harness.client
    private val transports get() = harness.transports
    private val transport get() = harness.transport
    private val closed get() = harness.closed
    private val opened get() = harness.opened

    private fun show() = harness.show(compose)

    private fun goLive() = harness.goLive(compose)

    /** The call's column is a lazy list: what's out of view isn't there until scrolled to. */
    private fun seen(text: String) {
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(text))
    }

    @Test
    fun aLearnerTalksTypesEndsAndReadsTheFeedback() {
        show()

        compose.onNodeWithText("Order at the café").assertExists()
        compose.onNodeWithText("Ask for a coffee").assertExists()
        seen("Speak or type. The microphone is used only during the call.")

        goLive()
        assertTrue(transport.microphone)
        compose.onNodeWithText("Listening…").assertExists()

        transport.onEvent(characterSays("¡Hola! ¿Qué le pongo?"))
        transport.onEvent(learnerSays("Un café, por favor.", 1000.0, 3000.0))
        seen("¡Hola! ¿Qué le pongo?")
        seen("Un café, por favor.")

        compose.onNode(hasSetTextAction()).performTextInput("Con leche")
        compose.onNodeWithContentDescription("Send").performClick()
        seen("Con leche")
        assertTrue(transport.instructions.last().endsWith("\"Con leche\""))

        compose.onNodeWithContentDescription("Help").performClick()
        seen("Phrases you can use")

        compose.onNodeWithContentDescription("End").performClick()
        compose.waitForIdle()

        val saved = api.completions.single()
        assertEquals(2L, saved.spokenSeconds)
        assertTrue(saved.usedHelp)
        assertEquals("Europe/Madrid", saved.timeZone)
        assertEquals(listOf("¡Hola! ¿Qué le pongo?", "Un café, por favor.", "Con leche"), saved.turns.map { it.text })

        compose.onNodeWithText("Order at the café").assertExists()
        compose.onNodeWithText("You did well.").assertExists()
        compose.onNodeWithText("Continue").performClick()
        compose.onNodeWithText("What went well").assertExists()
        compose.onNodeWithText("Continue").performClick()
        compose.onNodeWithText("To improve").assertExists()
        compose.onNodeWithText("Continue").performClick()
        assertEquals(1, closed)
    }

    @Test
    fun endingACallThatHasntConnectedGoesBackToItsIntro() {
        show()
        compose.onNodeWithText("Start the call").performClick()
        compose.onNodeWithText("Calling…").assertExists()

        compose.onNodeWithContentDescription("End").performClick()
        compose.waitForIdle()

        compose.onNodeWithText("Start the call").assertExists()
        assertEquals(listOf(com.zoonk.android.feature.livecall.CONNECTION), client.ended)
        assertTrue(transport.closed)
    }

    @Test
    fun aLockedCallOffersPlus() {
        api.stored = conversation(harness.id, locked = true, kind = LanguageConversation.Kind.CHECKPOINT)
        show()

        compose.onNodeWithText("Challenge calls come with Plus. Your plan keeps going without them.").assertExists()
        compose.onNodeWithText("See Plus").performClick()

        assertEquals(listOf<AppRoute>(AppRoute.Subscription), opened)
        assertTrue(client.connects.isEmpty())
    }

    @Test
    fun aCallLimitSaysWhenCallsComeBack() {
        client.reservations = ArrayDeque(listOf(CallReservation.Limited(Limit.Reached(LimitTier.Free, LimitPeriod.Day))))
        show()
        compose.onNodeWithText("Start the call").performClick()

        compose.onNodeWithText("No more calls today").assertExists()
        compose.onNodeWithText("Your calls come back tomorrow, or get Plus for higher call limits.").assertExists()
        compose.onNodeWithText("See Plus").performClick()
        assertEquals(listOf<AppRoute>(AppRoute.Subscription), opened)
    }

    @Test
    fun aCallOpenElsewhereCanBeTakenOver() {
        client.reservations =
            ArrayDeque(
                listOf(
                    CallReservation.CallInProgress,
                    CallReservation.Ready(
                        com.zoonk.android.feature.livecall
                            .setup(),
                    ),
                ),
            )
        show()
        compose.onNodeWithText("Start the call").performClick()

        compose.onNodeWithText("You're already in a call").assertExists()
        compose.onNodeWithText("End that call and start this one").performClick()
        compose.waitForIdle()

        assertEquals(listOf(false, true), client.connects)
        compose.onNodeWithText("Calling…").assertExists()
    }

    @Test
    fun aDroppedCallCanBeCalledAgainOrEndedForFeedback() {
        client.reservations =
            ArrayDeque(
                listOf(
                    CallReservation.Ready(
                        com.zoonk.android.feature.livecall
                            .setup(),
                    ),
                    CallReservation.Ready(
                        com.zoonk.android.feature.livecall
                            .setup(),
                    ),
                ),
            )
        show()
        goLive()

        transport.onLost()
        compose.waitForIdle()
        compose.onNodeWithText("The call dropped").assertExists()

        compose.onNodeWithText("Call again").performClick()
        compose.waitForIdle()
        assertEquals(2, transports.size)
        compose.onNodeWithText("Calling…").assertExists()
    }

    @Test
    fun theSendButtonWaitsForWords() {
        show()
        goLive()

        compose.onNodeWithContentDescription("Send").assertIsNotEnabled()
        compose.onNode(hasSetTextAction()).performTextInput("Hola")
        compose.onNodeWithContentDescription("Send").assertIsEnabled()
    }

    @Test
    fun aCallTheServerSaysEndedOffersANewOne() {
        api.completion = { CallCompletion.Ended }
        show()
        goLive()

        compose.onNodeWithContentDescription("End").performClick()
        compose.waitForIdle()

        compose.onNodeWithText("This call has ended").assertExists()
        compose.onNodeWithText("Start a new call to keep practicing.").assertExists()
        assertFalse(api.completions.isEmpty())
    }

    @Test
    fun endingADroppedCallSavesWhatWasSaid() {
        show()
        goLive()
        transport.onEvent(learnerSays("Un café", 1000.0, 2000.0))
        transport.onLost()
        compose.waitForIdle()

        compose.onNodeWithText("End the call").performClick()
        compose.waitForIdle()

        assertEquals(
            listOf("Un café"),
            api.completions
                .single()
                .turns
                .map { it.text },
        )
        compose.onNodeWithText("You did well.").assertExists()
    }
}
