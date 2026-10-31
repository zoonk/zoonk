package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SearchBarScrollBehavior
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll

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
 * the way back instead.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TabRootScaffold(
    modifier: Modifier = Modifier,
    content: @Composable (PaddingValues) -> Unit,
) {
    val bar = LocalTabRootBar.current
    val searchScroll = bar?.searchScroll?.invoke()

    Scaffold(
        modifier = searchScroll?.let { modifier.nestedScroll(it.nestedScrollConnection) } ?: modifier,
        topBar = {
            if (bar != null) {
                Column {
                    TopAppBar(title = bar.title, actions = bar.actions)
                    bar.search(searchScroll?.let { with(it) { Modifier.searchBarScrollBehavior() } } ?: Modifier)
                }
            }
        },
        content = content,
    )
}
