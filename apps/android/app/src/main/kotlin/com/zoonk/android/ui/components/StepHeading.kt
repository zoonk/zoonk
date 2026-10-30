package com.zoonk.android.ui.components

import androidx.compose.foundation.focusable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester

/** The heading a step takes TalkBack to when it opens. */
val LocalStepHeading = staticCompositionLocalOf<FocusRequester?> { null }

/** Marks a step's heading, where TalkBack goes when the step opens; one to a step. */
@Composable
fun Modifier.stepHeading(): Modifier {
    val heading = LocalStepHeading.current ?: return this
    return focusRequester(heading).focusable()
}
