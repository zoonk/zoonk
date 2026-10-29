package com.zoonk.android.feature.activities

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import com.zoonk.android.feature.player.model.ActivityAnswer

/**
 * After the app was closed in the background, a canvas's saved work comes back but the player's
 * answer doesn't: gives back [answer], the one that saved work makes.
 */
@Composable
fun RestoreActivityAnswer(
    props: ActivityProps,
    answer: () -> ActivityAnswer?,
) {
    LaunchedEffect(Unit) {
        if (props.answer == null && !props.isLocked) answer()?.let(props.onAnswerChange)
    }
}
