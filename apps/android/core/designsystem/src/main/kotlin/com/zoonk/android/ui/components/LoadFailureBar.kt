package com.zoonk.android.ui.components

import androidx.annotation.StringRes
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R

/** What a page's status puts in its bottom bar: a failed load's retries, else a missing page's way home. */
private class StatusAction {
    val retries = mutableStateListOf<() -> Unit>()
    val goHome = mutableStateListOf<() -> Unit>()
}

private val LocalStatusAction = compositionLocalOf<StatusAction?> { null }

/**
 * A page's status (a load that failed, a page that's missing) uses its screen's action slot only when the screen has no
 * main action of its own: "Try again", else "Go to Today", as main's error and not-found pages put them in the bar.
 */
@Composable
fun WithStatusAction(
    enabled: Boolean,
    content: @Composable (action: (@Composable () -> Unit)?) -> Unit,
) {
    val action = remember { StatusAction() }
    val bar: (@Composable () -> Unit)? =
        when {
            !enabled -> null
            action.retries.isNotEmpty() -> barButton(R.string.load_failed_try_again) { action.retries.toList().forEach { it() } }
            action.goHome.isNotEmpty() -> barButton(R.string.not_found_go_home) { action.goHome.first()() }
            else -> null
        }
    CompositionLocalProvider(LocalStatusAction provides action.takeIf { enabled }) { content(bar) }
}

private fun barButton(
    @StringRes label: Int,
    onClick: () -> Unit,
): @Composable () -> Unit =
    {
        TaskActions { main ->
            Button(onClick = onClick, modifier = main) { Text(stringResource(label)) }
        }
    }

/** Puts [onClick] in the page's bar through [list]'s holder; false where the page has no free bar to take it. */
@Composable
private fun inStatusAction(
    onClick: () -> Unit,
    list: StatusAction.() -> MutableList<() -> Unit>,
    allowed: Boolean = true,
): Boolean {
    val action = LocalStatusAction.current.takeIf { allowed } ?: return false
    val latest by rememberUpdatedState(onClick)
    DisposableEffect(action) {
        val invoke = { latest() }
        action.list().add(invoke)
        onDispose { action.list().remove(invoke) }
    }
    return true
}

@Composable
fun LoadFailureRetry(
    onRetry: () -> Unit,
    inBar: Boolean = true,
) {
    if (!inStatusAction(onRetry, { retries }, allowed = inBar)) {
        OutlinedButton(onClick = onRetry) { Text(stringResource(R.string.load_failed_try_again)) }
    }
}

/** A missing page's "Go to Today": in the page's bar where it's free, else under the message. */
@Composable
internal fun NotFoundGoHome(onGoHome: () -> Unit) {
    if (!inStatusAction(onGoHome, { goHome })) {
        Button(onClick = onGoHome) { Text(stringResource(R.string.not_found_go_home)) }
    }
}
