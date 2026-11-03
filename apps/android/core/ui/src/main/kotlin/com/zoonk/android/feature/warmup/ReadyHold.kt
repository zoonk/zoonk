package com.zoonk.android.feature.warmup

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.changedToDown
import androidx.compose.ui.input.pointer.pointerInput
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.withTimeoutOrNull

/**
 * When a wait that deals warm-up cards moves on once its work is ready. A learner who guessed on this
 * screen is playing, so it stays until they tap its main button. One who didn't moves on as soon as a
 * second passes without a touch, so a tap already on its way lands on the card, not on the next screen.
 */
@Stable
@ConsistentCopyVisibility
data class ReadyHold internal constructor(
    private val state: HoldState,
    /** Ready after a guess here: the screen says so, and only its main button moves on. */
    val holding: Boolean,
    /** The wait is over: the screen shows what comes after it. */
    val over: Boolean,
) {
    fun guess() = state.guess()

    fun moveOn() = state.moveOn()

    internal fun touch() = state.touch()

    internal val key: Any get() = state
}

@Composable
fun rememberReadyHold(ready: Boolean): ReadyHold {
    val state = rememberSaveable(saver = HoldState.Saver) { HoldState() }
    LaunchedEffect(state) { state.followTouches() }
    return ReadyHold(state, holding = state.holding(ready), over = state.over(ready))
}

/** Every touch on the wait, a key press included, starts its quiet second again. */
fun Modifier.watchTouches(hold: ReadyHold): Modifier =
    onPreviewKeyEvent {
        if (it.type == KeyEventType.KeyDown) hold.touch()
        false
    }.pointerInput(hold.key) {
        awaitPointerEventScope {
            while (true) {
                if (awaitPointerEvent(PointerEventPass.Initial).changes.any { it.changedToDown() }) hold.touch()
            }
        }
    }

internal class HoldState(
    guessed: Boolean = false,
    movedOn: Boolean = false,
) {
    private var guessed by mutableStateOf(guessed)
    private var movedOn by mutableStateOf(movedOn)
    private var quiet by mutableStateOf(true)
    private val touches = Channel<Unit>(Channel.CONFLATED)

    fun holding(ready: Boolean) = ready && guessed && !movedOn

    fun over(ready: Boolean) = ready && (movedOn || (!guessed && quiet))

    fun guess() {
        guessed = true
    }

    fun moveOn() {
        movedOn = true
    }

    fun touch() {
        touches.trySend(Unit)
    }

    suspend fun followTouches() {
        while (true) {
            touches.receive()
            quiet = false
            while (withTimeoutOrNull(QUIET_MILLIS) { touches.receive() } != null) continue
            quiet = true
        }
    }

    companion object {
        const val QUIET_MILLIS = 1_000L

        val Saver: Saver<HoldState, Any> = listSaver({ listOf(it.guessed, it.movedOn) }, { HoldState(it[0], it[1]) })
    }
}
