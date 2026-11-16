package com.zoonk.android.ui.components

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R

private class LoadFailureAction {
    var retry by mutableStateOf<(() -> Unit)?>(null)
}

private val LocalLoadFailureAction = compositionLocalOf<LoadFailureAction?> { null }

/** A load failure uses its screen's action slot only when the screen has no main action of its own. */
@Composable
fun WithLoadFailureBar(
    enabled: Boolean,
    content: @Composable (retry: (@Composable () -> Unit)?) -> Unit,
) {
    val action = remember { LoadFailureAction() }
    val retry = action.retry.takeIf { enabled }
    CompositionLocalProvider(LocalLoadFailureAction provides action.takeIf { enabled }) {
        content(
            retry?.let {
                {
                    TaskActions { main ->
                        Button(onClick = it, modifier = main) { Text(stringResource(R.string.load_failed_try_again)) }
                    }
                }
            },
        )
    }
}

@Composable
private fun loadFailureInBar(
    onRetry: () -> Unit,
    inBar: Boolean,
): Boolean {
    val action = LocalLoadFailureAction.current.takeIf { inBar } ?: return false
    val retry by rememberUpdatedState(onRetry)
    DisposableEffect(action) {
        val invoke = { retry() }
        action.retry = invoke
        onDispose { if (action.retry === invoke) action.retry = null }
    }
    return true
}

@Composable
fun LoadFailureRetry(
    onRetry: () -> Unit,
    inBar: Boolean = true,
) {
    if (!loadFailureInBar(onRetry, inBar)) {
        OutlinedButton(onClick = onRetry) { Text(stringResource(R.string.load_failed_try_again)) }
    }
}
