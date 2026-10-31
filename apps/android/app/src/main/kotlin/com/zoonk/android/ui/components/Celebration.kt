package com.zoonk.android.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.compositionLocalOf

private val LocalCelebrates = compositionLocalOf { true }

/**
 * `play = false` where only the screen knows its moment was already seen (a result reopened, a step
 * the learner went back to): what celebrates inside shows its end state, still. Nested scopes add up.
 */
@Composable
fun CelebrationScope(
    play: Boolean,
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(LocalCelebrates provides (LocalCelebrates.current && play), content = content)
}

/** Whether a celebration plays here, once; where it doesn't, it shows its end state, still. */
@Composable
@ReadOnlyComposable
fun celebrates(): Boolean = LocalCelebrates.current
