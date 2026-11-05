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

/** Put [requester] on whatever holds the pressed control's place. */
class PressFocus internal constructor(
    val requester: FocusRequester,
    private val arm: () -> Unit,
    private val moveNow: () -> Unit,
) {
    /** From a control that gives way to the next holder, such as Start. */
    fun press() = arm()

    /** From Try again inside the holder: it goes as the wait resumes, so focus moves to the holder now. */
    fun pressInHolder() {
        arm()
        moveNow()
    }
}

/**
 * After a press, each change of [holder] (the control itself, a notice or the wait in its place)
 * moves focus there, as [rememberMoveFocus] does, so it never drops with the control the learner
 * pressed. [holder] names the node, not its state: the wait and its failure are one holder, so a run
 * that fails on its own leaves focus where the learner put it. A null [holder] is a screen of its
 * own, which leaves focus alone. [reveal] brings an off-screen holder into view first.
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

    return remember(requester, moves) {
        PressFocus(requester, arm = { pressed = true }, moveNow = { if (moves()) requester.requestFocus() })
    }
}
