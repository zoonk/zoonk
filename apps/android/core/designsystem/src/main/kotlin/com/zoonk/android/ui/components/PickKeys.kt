package com.zoonk.android.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.input.key.Key

private val PICK_KEYS =
    listOf(Key.One, Key.Two, Key.Three, Key.Four, Key.Five, Key.Six, Key.Seven, Key.Eight, Key.Nine, Key.Zero)
private val NUMPAD_PICK_KEYS =
    listOf(
        Key.NumPad1,
        Key.NumPad2,
        Key.NumPad3,
        Key.NumPad4,
        Key.NumPad5,
        Key.NumPad6,
        Key.NumPad7,
        Key.NumPad8,
        Key.NumPad9,
        Key.NumPad0,
    )

/**
 * Main's `pickKey`: the option a number key picks. 1 to 9 pick the first nine and 0, the key after 9 on the number row,
 * the tenth; null for any other key.
 */
fun Key.pickIndex(): Int? = PICK_KEYS.indexOf(this).takeIf { it >= 0 } ?: NUMPAD_PICK_KEYS.indexOf(this).takeIf { it >= 0 }

/**
 * Where a task's frame, which holds keyboard focus, sends its number keys (main's `useNumberKeys`): to what's on screen
 * while its keys pick it ([PickKeyOptions], a match board), and nowhere once it's gone.
 */
class PickKeys {
    private var taken: ((Int) -> Boolean)? = null

    /** Picks what [index]'s key picks; false while nothing on screen takes the keys or nothing is at [index]. */
    fun press(index: Int): Boolean = taken?.invoke(index) == true

    /** Gives the keys to [pick], or takes them back with null. */
    fun take(pick: ((Int) -> Boolean)?) {
        taken = pick
    }

    internal fun release(pick: (Int) -> Boolean) {
        if (taken === pick) taken = null
    }
}

/** The [PickKeys] of the frame around a task; null where no frame sends number keys. */
val LocalPickKeys = staticCompositionLocalOf<PickKeys?> { null }

/** Whether the answer options here show their number keys: only where a key picks them, as main's keycaps. */
val LocalOptionKeys = staticCompositionLocalOf { false }

/**
 * Options a number key picks: while [enabled], the frame's keys run [onPick] for the first [count], and the options in
 * [content] show their keys. Where no frame sends number keys, the options show none.
 */
@Composable
fun PickKeyOptions(
    count: Int,
    enabled: Boolean,
    onPick: (Int) -> Unit,
    content: @Composable () -> Unit,
) {
    val keys = LocalPickKeys.current
    val pick by rememberUpdatedState(onPick)
    DisposableEffect(keys, count, enabled) {
        val picks = { index: Int -> (index < count).also { if (it) pick(index) } }
        if (enabled) keys?.take(picks)
        onDispose { keys?.release(picks) }
    }
    CompositionLocalProvider(LocalOptionKeys provides (keys != null), content = content)
}
