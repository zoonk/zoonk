package com.zoonk.android.ui.components

import android.view.accessibility.AccessibilityManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInputModeManager

@Composable
private fun rememberFocusMoves(): () -> Boolean {
    val inputModes = LocalInputModeManager.current
    val context = LocalContext.current
    return remember(inputModes, context) {
        {
            val screenReader = context.getSystemService(AccessibilityManager::class.java)?.isTouchExplorationEnabled == true
            inputModes.inputMode == InputMode.Keyboard || screenReader
        }
    }
}

/**
 * Moves focus for a keyboard or a screen reader, say once the control they used gives way. A touch
 * moves no focus, so focus moved for one would stay where it went, unseen.
 */
@Composable
fun rememberMoveFocus(): (FocusRequester) -> Unit {
    val moves = rememberFocusMoves()
    return remember(moves) { { requester -> if (moves()) requester.requestFocus() } }
}

/** Put [requester] on whatever holds the pressed control's place, and call [press] from the controls that start. */
class PressFocus(
    val requester: FocusRequester,
    val press: () -> Unit,
)

/**
 * After the learner presses Start or Try again, each change of [holder] (the control itself, a
 * notice or the wait in its place) moves focus there, as [rememberMoveFocus] does, so it never
 * drops with the control they pressed. A null [holder] is a screen of its own, which leaves focus
 * alone. [reveal] brings an off-screen holder into view first.
 */
@Composable
fun rememberPressFocus(
    holder: Any?,
    reveal: suspend () -> Unit = {},
): PressFocus {
    val requester = remember { FocusRequester() }
    val moves = rememberFocusMoves()
    var pressed by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(holder) {
        if (pressed && holder != null && moves() && !requester.requestFocus()) {
            reveal()
            requester.requestFocus()
        }
    }

    return remember(requester) { PressFocus(requester) { pressed = true } }
}
