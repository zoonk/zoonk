package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SearchBarScrollBehavior
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.unit.dp

/**
 * The parts of a tab root's app bar that come from features above the tabs (the goal switcher,
 * level, account menu and search), which the shell provides through [LocalTabRootBar].
 */
@OptIn(ExperimentalMaterial3Api::class)
class TabRootBar(
    val title: @Composable () -> Unit,
    val actions: @Composable RowScope.() -> Unit,
    val search: @Composable (Modifier) -> Unit,
    val searchScroll: @Composable () -> SearchBarScrollBehavior?,
)

val LocalTabRootBar = staticCompositionLocalOf<TabRootBar?> { null }

/**
 * A tab's own page (Today, the Plan, the buddy): main's app bar as its top app bar, with the goal
 * switcher, the belt and level that lead to Statistics and the account menu, and search under it,
 * which scrolls away with the page on phones. Pages a tab opens have their own top app bar with
 * the way back instead. On an unfolded book foldable the goal and search end on the page before the
 * fold, as the page's first pane does.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TabRootScaffold(
    modifier: Modifier = Modifier,
    content: @Composable (PaddingValues) -> Unit,
) {
    val bar = LocalTabRootBar.current
    val searchScroll = bar?.searchScroll?.invoke()

    BoxWithConstraints(modifier) {
        val fold = pageFold(maxWidth)
        // The title starts 16dp into the bar and ends as far before the fold; search keeps its own margin.
        val title = fold?.let { Modifier.widthIn(max = it.start - 32.dp) } ?: Modifier
        val search = fold?.let { Modifier.widthIn(max = it.start) } ?: Modifier

        Scaffold(
            modifier = searchScroll?.let { Modifier.nestedScroll(it.nestedScrollConnection) } ?: Modifier,
            topBar = {
                if (bar != null) {
                    Column {
                        TopAppBar(title = { Box(title) { bar.title() } }, actions = bar.actions)
                        bar.search(searchScroll?.let { with(it) { search.searchBarScrollBehavior() } } ?: search)
                    }
                }
            },
            content = content,
        )
    }
}
