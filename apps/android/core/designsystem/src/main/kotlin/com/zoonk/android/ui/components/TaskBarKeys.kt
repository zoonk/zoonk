package com.zoonk.android.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.staticCompositionLocalOf

/** A key a task's bar answers with one of its buttons: [Sound] is P, main's `audio` shortcut, and [Main] is Enter. */
enum class TaskBarKey { Sound, Main }

/**
 * The keys a task's frame, which holds keyboard focus, hands to the buttons in its bar: each button takes its key while it shows
 * ([TakeTaskBarKey]), so the key does exactly what pressing it does, and nothing once it's gone.
 */
class TaskBarKeys {
    private val taken = mutableMapOf<TaskBarKey, () -> Unit>()

    /** Presses the button that took [key]; false while none shows, so the frame does its own. */
    fun press(key: TaskBarKey): Boolean {
        val press = taken[key] ?: return false
        press()
        return true
    }

    internal fun take(
        key: TaskBarKey,
        press: () -> Unit,
    ) {
        taken[key] = press
    }

    internal fun release(
        key: TaskBarKey,
        press: () -> Unit,
    ) {
        if (taken[key] === press) taken.remove(key)
    }
}

/** The [TaskBarKeys] of the frame around a task's bar; null outside one. */
val LocalTaskBarKeys = staticCompositionLocalOf<TaskBarKeys?> { null }

/** While this shows in a frame's bar, [key] runs [onPress], the button's own click; null while the button can't be pressed. */
@Composable
fun TakeTaskBarKey(
    key: TaskBarKey,
    onPress: (() -> Unit)?,
) {
    val keys = LocalTaskBarKeys.current ?: return
    val current by rememberUpdatedState(onPress)
    val pressable = onPress != null
    DisposableEffect(keys, key, pressable) {
        val press = { current?.invoke() ?: Unit }
        if (pressable) keys.take(key, press)
        onDispose { keys.release(key, press) }
    }
}
