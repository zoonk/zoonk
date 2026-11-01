package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier

/**
 * A page's or a task's top bar. Across an unfolded book foldable's fold each page gets its part:
 * [bar] (the way back or out, and the title) over the page before the fold, [actions] over the page
 * after it, so the title never runs across the fold. Elsewhere [bar] holds the actions itself.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun TopBarAcrossFold(
    actions: @Composable RowScope.() -> Unit,
    bar: @Composable (modifier: Modifier, actions: @Composable RowScope.() -> Unit) -> Unit,
) {
    var span by remember { mutableStateOf<PageSpan?>(null) }

    BoxWithConstraints(Modifier.onPageSpan { span = it }) {
        val fold = pageFold(maxWidth, span)

        if (fold == null) {
            bar(Modifier, actions)
        } else {
            Row {
                bar(Modifier.width(fold.start)) {}
                TopAppBar(title = {}, actions = actions, modifier = Modifier.weight(1f).padding(start = fold.end - fold.start))
            }
        }
    }
}
