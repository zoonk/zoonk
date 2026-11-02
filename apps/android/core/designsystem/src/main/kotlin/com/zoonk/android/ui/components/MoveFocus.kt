package com.zoonk.android.ui.components

import android.view.accessibility.AccessibilityManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInputModeManager

/**
 * Moves focus for a keyboard or a screen reader, say once the control they used gives way. A touch
 * moves no focus, so focus moved for one would stay where it went, unseen.
 */
@Composable
fun rememberMoveFocus(): (FocusRequester) -> Unit {
    val inputModes = LocalInputModeManager.current
    val context = LocalContext.current
    return remember(inputModes, context) {
        { requester ->
            val screenReader = context.getSystemService(AccessibilityManager::class.java)?.isTouchExplorationEnabled == true
            if (inputModes.inputMode == InputMode.Keyboard || screenReader) requester.requestFocus()
        }
    }
}
