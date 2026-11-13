package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.NotFoundMessage
import com.zoonk.android.ui.components.PageLoading

/**
 * A page that shows one resource: [content] once it has loaded, and otherwise a [PageScaffold] with the way back and
 * what the learner can do: a spinner while it loads, "try again" when the read failed, and "not found" when it doesn't
 * exist or came back empty.
 */
@Composable
fun <T> LoadedPage(
    state: LoadState<T>,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onGoHome: () -> Unit,
    content: @Composable (T) -> Unit,
) {
    when (state) {
        is LoadState.Loaded -> {
            content(state.value)
        }

        LoadState.Idle, LoadState.Loading -> {
            PageScaffold(onBack = onBack) { PageLoading(Modifier.padding(it), MaterialTheme.colorScheme.tertiary) }
        }

        LoadState.Empty -> {
            PageScaffold(onBack = onBack) { NotFoundMessage(onGoHome, Modifier.padding(it)) }
        }

        is LoadState.Failed -> {
            PageScaffold(onBack = onBack) { padding ->
                if (state.error == ApiError.NotFound) {
                    NotFoundMessage(onGoHome, Modifier.padding(padding))
                } else {
                    LoadFailedMessage(onRetry, Modifier.padding(padding))
                }
            }
        }
    }
}
