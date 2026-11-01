package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.zoonk.android.ui.scaffold.PageSpan
import com.zoonk.android.ui.scaffold.onPageSpan
import com.zoonk.android.ui.scaffold.pageFold

/**
 * Material's snackbar host, centered under what it spans. Across an unfolded book foldable's fold
 * its snackbars show on the page after the fold, as sheets and dialogs do, instead of on the fold.
 */
@Composable
fun SnackbarHost(
    hostState: SnackbarHostState,
    modifier: Modifier = Modifier,
) {
    var span by remember { mutableStateOf<PageSpan?>(null) }

    BoxWithConstraints(modifier.fillMaxWidth().onPageSpan { span = it }) {
        val fold = pageFold(maxWidth, span)

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
