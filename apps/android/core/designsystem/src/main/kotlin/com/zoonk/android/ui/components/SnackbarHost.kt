package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.zoonk.android.app.LocalSnackbarLayer
import com.zoonk.android.app.SnackbarLayer
import com.zoonk.android.ui.scaffold.PageSpan
import com.zoonk.android.ui.scaffold.onPageSpan
import com.zoonk.android.ui.scaffold.screenSplit

/**
 * Material's snackbar host, centered under what it spans. Across an unfolded book foldable's fold,
 * or a spread's split on a wide window ([screenSplit]), its snackbars show on the page after it, as
 * sheets do, instead of on the fold. Under an open sheet or full-screen dialog ([SnackbarLayer]) it
 * shows none, leaving them to the layer on top.
 */
@Composable
fun SnackbarHost(
    hostState: SnackbarHostState,
    modifier: Modifier = Modifier,
) {
    if (LocalSnackbarLayer.current.isCovered) return

    var span by remember { mutableStateOf<PageSpan?>(null) }

    BoxWithConstraints(modifier.fillMaxWidth().onPageSpan { span = it }) {
        val fold = screenSplit(maxWidth, span)

        Box(
            if (fold ==
                null
            ) {
                Modifier.fillMaxWidth()
            } else {
                Modifier.fillMaxWidth().padding(start = fold.end)
            },
            contentAlignment = Alignment.Center,
        ) {
            androidx.compose.material3.SnackbarHost(hostState)
        }
    }
}

/** [content], a sheet or a dialog, as the window's top [SnackbarLayer] while it shows. */
@Composable
internal fun SnackbarLayerOver(content: @Composable () -> Unit) {
    val under = LocalSnackbarLayer.current

    DisposableEffect(under) {
        under.cover()
        onDispose { under.uncover() }
    }

    CompositionLocalProvider(LocalSnackbarLayer provides remember { SnackbarLayer() }, content = content)
}
