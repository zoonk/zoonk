package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import com.zoonk.android.app.LocalSnackbarAnchors

/**
 * Actions pinned to the bottom over a hairline. The window's snackbars show above it. Across an
 * unfolded book foldable's fold, or a spread's split on a wide window ([screenSplit]), the actions
 * sit on the page after it, off the fold and where the learner's turn is.
 */
@Composable
fun DockedActionBar(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val anchors = LocalSnackbarAnchors.current
    val key = remember { Any() }
    var span by remember { mutableStateOf<PageSpan?>(null) }

    DisposableEffect(anchors) { onDispose { anchors.remove(key) } }

    Surface(modifier.onGloballyPositioned { anchors.set(key, it.boundsInRoot().top) }.onPageSpan { span = it }) {
        BoxWithConstraints {
            val fold = screenSplit(maxWidth, span)

            Column {
                HorizontalDivider()
                Column(if (fold == null) Modifier else Modifier.padding(start = fold.end), content = content)
            }
        }
    }
}
