package com.zoonk.android.feature.conversation

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.livecall.CallReservation
import com.zoonk.android.feature.livecall.LiveServerEvent
import com.zoonk.android.feature.livecall.characterSays
import com.zoonk.android.feature.livecall.learnerSays
import com.zoonk.android.feature.livecall.setup
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Review screenshots of a call's screens: `-Pzoonk.shots=<folder>`. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ConversationScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder>", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = walk("phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDark() = walk("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        walk("phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-mdpi")
    fun tablet() = walk("tablet")

    @Test
    @Config(qualifiers = "w851dp-h882dp-xhdpi")
    fun foldOpen() = walk("fold-open")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun limit() {
        val harness = ConversationHarness()
        harness.client.reservations = ArrayDeque(listOf(CallReservation.Limited(Limit.Reached(LimitTier.Free, LimitPeriod.Day))))
        harness.show(compose)
        compose.onNodeWithText("Call Lucía").performClick()
        shot("problem-limit-phone")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun dropped() {
        val harness = ConversationHarness()
        harness.show(compose)
        harness.goLive(compose)
        harness.transport.onLost()
        shot("problem-dropped-phone")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun reconnectPaused() = reconnectRefused(CallReservation.CallsPaused, "paused")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun reconnectInProgress() = reconnectRefused(CallReservation.CallInProgress, "in-progress")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun reconnectLimited() = reconnectRefused(CallReservation.Limited(Limit.Reached(LimitTier.Free, LimitPeriod.Day)), "limit")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun reconnectPlusRequired() = reconnectRefused(CallReservation.PlusRequired, "plus")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-mdpi")
    fun reconnectInProgressTablet() = reconnectRefused(CallReservation.CallInProgress, "in-progress-tablet")

    private fun reconnectRefused(
        refusal: CallReservation,
        name: String,
    ) {
        val harness = ConversationHarness()
        harness.client.reservations = ArrayDeque(listOf(CallReservation.Ready(setup()), refusal))
        harness.show(compose)
        harness.goLive(compose)
        harness.transport.onEvent(characterSays("¡Hola! Bienvenido al Café Central. ¿Qué le pongo?"))
        harness.transport.onLost()
        compose.onNodeWithText("Call again").performClick()
        shot("reconnect-$name")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun calledAgain() {
        val harness = ConversationHarness()
        harness.client.reservations =
            ArrayDeque(listOf(CallReservation.Ready(setup()), CallReservation.Ready(setup(talkSeconds = 120, continuesCall = true))))
        harness.show(compose)
        harness.goLive(compose)
        harness.transport.onEvent(characterSays("¡Hola! Bienvenido al Café Central. ¿Qué le pongo?"))
        harness.transport.onEvent(learnerSays("Hola, quería un café con leche, por favor.", 1000.0, 3200.0))
        harness.transport.onEvent(characterSays("Muy bien. ¿Algo más?"))
        shot("again-0-before-drop-phone")
        harness.transport.onLost()
        shot("again-1-dropped-phone")
        compose.onNodeWithText("Call again").performClick()
        shot("again-2-calling-phone")
        harness.transport.onEvent(LiveServerEvent.Started)
        harness.transport.onEvent(characterSays("Perdone, se cortó. Un café con leche, entonces. ¿Algo más?"))
        shot("again-3-live-phone")
    }

    private fun walk(
        name: String,
        dark: Boolean = false,
    ) {
        val harness = ConversationHarness()
        harness.show(compose, dark)
        shot("intro-$name")

        compose.onNodeWithText("Call Lucía").performClick()
        shot("calling-$name")
        harness.transport.onEvent(LiveServerEvent.Started)
        harness.transport.onEvent(characterSays("¡Hola! Bienvenido al Café Central. ¿Qué le pongo?"))
        shot("live-talking-$name")
        harness.transport.onEvent(learnerSays("Hola, quería un café con leche, por favor.", 1000.0, 3200.0))
        harness.transport.onEvent(characterSays("Muy bien. ¿Algo más?"))
        compose.mainClock.advanceTimeBy(2000)
        shot("live-$name")
        compose.onNodeWithContentDescription("Help").performClick()
        shot("live-help-$name")

        compose.onNodeWithContentDescription("End").performClick()
        var step = 0
        while (harness.closed == 0) {
            shot("result-$step-$name")
            compose.onNodeWithText("Continue").performClick()
            step++
        }
    }

    private fun shot(name: String) {
        compose.waitForIdle()
        val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
