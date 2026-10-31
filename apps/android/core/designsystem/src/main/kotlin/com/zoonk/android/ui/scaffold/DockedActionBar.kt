package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import com.zoonk.android.app.LocalSnackbarAnchors

/** Actions pinned to the bottom over a hairline. The window's snackbars show above it. */
@Composable
fun DockedActionBar(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val anchors = LocalSnackbarAnchors.current
    val key = remember { Any() }

    DisposableEffect(anchors) { onDispose { anchors.remove(key) } }

    Surface(modifier.onGloballyPositioned { anchors.set(key, it.boundsInRoot().top) }) {
        Column {
            HorizontalDivider()
            content()
        }
    }
}
