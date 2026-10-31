package com.zoonk.android.app

import androidx.annotation.StringRes
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalResources
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update

/**
 * Snackbars for work that outlives its screen, such as a sign-out or a sent message: the window
 * showing when one is due shows it, and one a recreated window cut short shows again in the next.
 */
class AppSnackbars {
    private class Due(
        @param:StringRes val message: Int,
    )

    private val queue = MutableStateFlow<List<Due>>(emptyList())

    fun show(
        @StringRes message: Int,
    ) = queue.update { it + Due(message) }

    internal suspend fun showIn(
        host: SnackbarHostState,
        text: (Int) -> String,
    ) {
        while (true) {
            val next = queue.first { it.isNotEmpty() }.first()
            host.showSnackbar(text(next.message))
            queue.update { it - next }
        }
    }
}

/** The window's snackbars, which also show [AppContainer.snackbars]. */
@Composable
fun rememberWindowSnackbars(app: AppContainer): SnackbarHostState {
    val host = remember { SnackbarHostState() }
    val resources = LocalResources.current

    LaunchedEffect(app, host) { app.snackbars.showIn(host, resources::getString) }

    return host
}
