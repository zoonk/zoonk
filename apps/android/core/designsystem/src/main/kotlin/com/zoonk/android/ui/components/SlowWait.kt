package com.zoonk.android.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kotlinx.coroutines.delay
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds

/** Whether [pending] has stayed on for [after], by default until a wait turns slow; false again the moment it's off. */
@Composable
fun rememberSlowWait(
    pending: Boolean,
    after: Duration = SLOW_WAIT,
): Boolean {
    var waited by remember { mutableStateOf(false) }

    LaunchedEffect(pending, after) {
        waited = false
        if (!pending) return@LaunchedEffect
        delay(after)
        waited = true
    }

    return pending && waited
}

/** Main's `SLOW_MS`: a wait says nothing until then, neither a busy button's spinner nor a wait's line. */
private val SLOW_WAIT = 1500.milliseconds
