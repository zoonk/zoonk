package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.add
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.adaptive.allVerticalHingeBounds
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.coerceAtLeast
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.takeOrElse
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.ui.components.ICON_BUTTON_BLANK
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.WithStatusAction
import com.zoonk.android.ui.theme.TextStartsOnLayoutStart

/**
 * A page a tab or another page opened: its top bar with the way back, [title] and [actions]. A page
 * that leads its content with its title (`PageTitleRow`, as main's pages do) shows [title] in the bar
 * only once that heading scrolls under it. A page's main action goes in [bottomBar], pinned to the
 * bottom in the [BottomBar], with its buttons in `TaskActions { main -> … }` so on a wide window the main
 * action sits at its own width at the end of the page's column; [barWidth] is that column's width, so the
 * bar stays under what it acts on. A page that centers its column says its width, its margins included, with
 * [columnWidth] instead, and the whole top bar keeps to it too: the way back, the title and the actions. What the whole
 * screen shares in place of a title, such as a step counter, goes in [middle], centered on the bar as main's `PageTopRow`
 * centers it, and on the page before a book's fold. The page lays out its content in [pagePadding].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PageScaffold(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    title: @Composable () -> Unit = {},
    middle: (@Composable () -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
    bottomBar: (@Composable ColumnScope.() -> Unit)? = null,
    barWidth: Dp = Dp.Unspecified,
    columnWidth: Dp = Dp.Unspecified,
    /** Off while a request that moves the learner on is out: Back waits with it. */
    backEnabled: Boolean = true,
    /** The page is in a task for now, such as a test inside the setup: its way back is the task's ✕, which [onBack] does. */
    closes: Boolean = false,
    content: @Composable (PaddingValues) -> Unit,
) {
    val focus = rememberTitleFocus()

    TextStartsOnLayoutStart {
        WithStatusAction(enabled = bottomBar == null) { retry ->
            Scaffold(
                modifier = Modifier.pageFocus(focus).then(modifier),
                topBar = {
                    // Across an unfolded book's fold the title ends at the fold. The actions keep their slot at the bar's end, past
                    // the fold, so what they opened stays open as the book folds.
                    val inContent by remember(focus) { derivedStateOf { focus.headingInView() } }
                    var span by remember { mutableStateOf<PageSpan?>(null) }
                    // The bar lays out in the room the page's content has: clear of the side system bars the page still receives,
                    // not of one the shell's rail already took. The content centers its column there, and the bar keeps to it.
                    BoxWithConstraints(
                        Modifier.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal)).onPageSpan {
                            span =
                                it
                        },
                    ) {
                        // Across a fold the column is the page before it.
                        val columnInset =
                            if (columnWidth == Dp.Unspecified ||
                                screenSplit(maxWidth, span) != null
                            ) {
                                0.dp
                            } else {
                                ((maxWidth - columnWidth) / 2).coerceAtLeast(0.dp)
                            }
                        val back =
                            @Composable {
                                if (closes) {
                                    CloseButton(onClick = onBack, modifier = Modifier.offset(x = pageMargin() - CLOSE_INK_START))
                                } else {
                                    BackButton(
                                        onClick = onBack,
                                        modifier = Modifier.offset(x = pageMargin() - BACK_INK_START),
                                        enabled = backEnabled,
                                    )
                                }
                            }
                        val insets = TopAppBarDefaults.windowInsets.add(WindowInsets(left = columnInset, right = columnInset))
                        if (middle == null) {
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
                                navigationIcon = back,
                                actions = { PageBarActions(actions) },
                                windowInsets = insets,
                            )
                        } else {
                            val fold = screenSplit(maxWidth, span)
                            CenterAlignedTopAppBar(
                                title = { if (fold == null) middle() },
                                modifier = Modifier.pageBar(focus),
                                navigationIcon = {
                                    if (fold == null) {
                                        back()
                                    } else {
                                        // Material's bar starts its navigation slot [BAR_INSET] in, so the spacer is that much wider to center the middle on the page.
                                        Row(Modifier.width(fold.start - BAR_INSET), verticalAlignment = Alignment.CenterVertically) {
                                            back()
                                            Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { middle() }
                                            Spacer(Modifier.width(BACK_WIDTH + BAR_INSET))
                                        }
                                    }
                                },
                                actions = { PageBarActions(actions) },
                                windowInsets = insets,
                            )
                        }
                    }
                },
                bottomBar = {
                    if (bottomBar != null) {
                        BottomBar(columnWidth = barWidth.takeOrElse { columnWidth }, content = bottomBar)
                    } else if (retry != null) {
                        BottomBar(columnWidth = barWidth.takeOrElse { columnWidth }) { retry() }
                    }
                },
                content = { padding -> CompositionLocalProvider(LocalTitleFocus provides focus) { content(padding) } },
            )
        }
    }
}

/**
 * A page's top bar actions, which end where its column does: a bare icon button's glyph on the page's margin at every
 * width, and a boxed button's box with [com.zoonk.android.ui.components.barButtonEnd].
 */
@Composable
fun PageBarActions(content: @Composable RowScope.() -> Unit) {
    Row(Modifier.offset(x = BAR_GLYPH_END - pageMargin()), verticalAlignment = Alignment.CenterVertically, content = content)
}

/** A page's column of at most [width], centered where the page is wider: the column a [PageScaffold]'s `columnWidth` names. */
fun Modifier.centeredColumn(width: Dp): Modifier =
    fillMaxSize().wrapContentWidth(Alignment.CenterHorizontally).widthIn(max = width).fillMaxWidth()

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

/** How far a list's edge sits inside the window: its rows inset their words by [LIST_ITEM_INSET], so the words start on [pageMargin]. */
@Composable
fun pageListMargin(): Dp = pageMargin() - LIST_ITEM_INSET

/**
 * Material's window margin: 16dp on a phone, 24dp from medium windows up. A book foldable's pages are each
 * about a phone wide, so a window a fold splits keeps a phone's margin, the way back and the bars included.
 */
@Composable
fun pageMargin(): Dp {
    val window = windowAdaptiveInfo()
    val wide = window.windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND)
    return if (wide && window.windowPosture.allVerticalHingeBounds.isEmpty()) 24.dp else 16.dp
}

/**
 * Where the back arrow's ink starts unpulled: Material's bar insets its navigation icon 4dp, the button centers
 * the 24dp glyph in its 48dp, and `ic_arrow_back` leaves 4dp blank before its ink. Pulled by the rest, the arrow
 * lines up by its ink with the page's margin, as the task bar's close button does.
 */
private val BACK_INK_START = 4.dp + (48.dp - 24.dp) / 2 + 4.dp

/** `ic_close` leaves 5dp blank before its ink. */
private val CLOSE_INK_START = 4.dp + (48.dp - 24.dp) / 2 + 5.dp

/** Where Material's bar starts its navigation slot, and the back button's width there. */
private val BAR_INSET = 4.dp
private val BACK_WIDTH = 48.dp

/** Where Material's bar puts a bare icon button's glyph: its actions end 4dp from the window, the button 12dp past its glyph. */
private val BAR_GLYPH_END = 4.dp + ICON_BUTTON_BLANK

private val PAGE_TOP = 8.dp
private val PAGE_BOTTOM = 24.dp
