package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass

/**
 * A page a tab or another page opened: its top bar with the way back, [title] and [actions]. A page
 * that leads its content with its title (`PageTitleRow`, as main's pages do) shows [title] in the bar
 * only once that heading scrolls under it. A page's main action goes in [bottomBar], pinned to the
 * bottom in the [BottomBar]; the page lays out its content in [pagePadding].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PageScaffold(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    title: @Composable () -> Unit = {},
    actions: @Composable RowScope.() -> Unit = {},
    bottomBar: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable (PaddingValues) -> Unit,
) {
    val focus = rememberTitleFocus()

    Scaffold(
        modifier = Modifier.pageFocus(focus).then(modifier),
        topBar = {
            // Across an unfolded book's fold the title ends at the fold. The actions keep their slot at the bar's end, past
            // the fold, so what they opened stays open as the book folds.
            val inContent by remember(focus) { derivedStateOf { focus.headingInView() } }
            TopAppBar(
                title = {
                    BeforeFold { beforeFold ->
                        Box(
                            // Drawn by where the heading is in this frame, so the title doesn't flash in before the content lays out.
                            Modifier
                                .graphicsLayer { alpha = if (focus.headingInView()) 0f else 1f }
                                .then(if (inContent) Modifier.clearAndSetSemantics {} else Modifier)
                                .then(beforeFold.titleTarget(focus.bar)),
                        ) { title() }
                    }
                },
                modifier = Modifier.pageBar(focus),
                navigationIcon = { BackButton(onClick = onBack) },
                actions = actions,
            )
        },
        bottomBar = { bottomBar?.let { BottomBar(content = it) } },
        content = { padding -> CompositionLocalProvider(LocalTitleFocus provides focus) { content(padding) } },
    )
}

/**
 * The room around a page's content: Material's margins at the sides ([pageMargin]), a little over its
 * title under the top bar and more under its last line. Every page and tab root lays its content out
 * in it, so their titles start at one height; no screen sets its own.
 */
@Composable
fun pagePadding(): PaddingValues {
    val margin = pageMargin()
    return PaddingValues(start = margin, end = margin, top = PAGE_TOP, bottom = PAGE_BOTTOM)
}

/** Material's window margin: 16dp on a phone, 24dp from medium windows up. */
@Composable
fun pageMargin(): Dp =
    if (windowAdaptiveInfo().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND)) 24.dp else 16.dp

private val PAGE_TOP = 8.dp
private val PAGE_BOTTOM = 24.dp
