package com.zoonk.android.feature.catalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblemMenu
import com.zoonk.android.feature.search.SearchAction
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.windowAdaptiveInfo
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch

/**
 * A catalog page's frame (main's `CatalogPageBar` and its states): its title in the top app bar,
 * pull to refresh, the loading wheel only while nothing is cached, and main's not-found page. The
 * page's [blocks] read in one column; across an unfolded book foldable's fold the trailing ones
 * read on the page after it, each page about a phone wide.
 */
@Composable
internal fun <T : Any> CatalogPage(
    app: AppContainer,
    navigator: AppNavigator,
    resource: Resource<T>,
    state: LoadState<T>,
    title: String?,
    report: FeedbackTarget? = null,
    alsoShown: List<Resource<*>> = emptyList(),
    blocks: (T, CatalogPageLayout) -> List<CatalogBlock>,
) {
    val scope = rememberCoroutineScope()
    val isRefreshing by resource.isRefreshing.collectAsStateWithLifecycle()
    val reading = rememberSaveable(saver = CatalogReading.Saver) { CatalogReading() }
    val disclosures = rememberSaveable(saver = Disclosures.Saver) { Disclosures() }
    var headlineList by remember { mutableStateOf<LazyListState?>(null) }
    var listTop by remember { mutableFloatStateOf(0f) }
    var headlineBottom by remember { mutableFloatStateOf(Float.POSITIVE_INFINITY) }
    val headlineScrolledAway by remember {
        derivedStateOf { (headlineList?.firstVisibleItemIndex ?: 0) > 0 || headlineBottom < listTop }
    }
    val refresh: () -> Unit = { (listOf(resource) + alsoShown).forEach { scope.launch { it.refresh() } } }
    val sizeClass = windowAdaptiveInfo().windowSizeClass
    val headline = Modifier.onGloballyPositioned { headlineBottom = it.boundsInWindow().bottom }

    PageScaffold(
        onBack = { navigator.back() },
        title = { if (headlineScrolledAway) title?.let { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
        actions = {
            SearchAction()
            if (report != null && state is LoadState.Loaded) ReportProblemMenu(app, report)
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = refresh,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            // The pages meet at the fold, each with its own margins, as a book's do.
            PageWithSupportingPane(
                atFoldOnly = true,
                panesTouch = true,
                supportingPane = {
                    if (state is LoadState.Loaded) {
                        val layout = CatalogPageLayout(beside = false, headline = Modifier, disclosures, twoPages = true)
                        val shown = blocks(state.value, layout).filter { it.trailing }
                        val listState = remember { reading.listState(shown) }
                        BlockList(shown, listState, reading, PANE_MARGIN, Modifier.fillMaxSize())
                    }
                },
            ) { twoPages ->
                when (state) {
                    LoadState.Idle, LoadState.Loading -> {
                        PageLoading()
                    }

                    is LoadState.Failed -> {
                        if (state.error == ApiError.NotFound) {
                            CatalogNotFound(navigator)
                        } else {
                            LoadFailedMessage(onRetry = refresh)
                        }
                    }

                    LoadState.Empty -> {
                        CatalogNotFound(navigator)
                    }

                    is LoadState.Loaded -> {
                        val beside = !twoPages && sizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND)
                        val wide = !twoPages && sizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND)
                        val all = blocks(state.value, CatalogPageLayout(beside, headline, disclosures, twoPages))
                        val shown = if (twoPages) all.filterNot { it.trailing } else all
                        val listState = remember(twoPages) { reading.listState(shown) }
                        SideEffect { headlineList = listState }

                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                            BlockList(
                                blocks = shown,
                                state = listState,
                                reading = reading,
                                margin = if (wide) 24.dp else PANE_MARGIN,
                                modifier =
                                    Modifier.widthIn(max = PAGE_WIDTH).fillMaxSize().onGloballyPositioned {
                                        listTop = it.boundsInWindow().top
                                    },
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * How a page's blocks lay out in the list that shows them. [beside] when that list is wide enough
 * for main's paired first screen (the page beside the lesson to try); [twoPages] when the page reads
 * as an open book's two pages, its trailing blocks after the fold.
 */
internal data class CatalogPageLayout(
    val beside: Boolean,
    /** Goes on the page's headline, so the top app bar takes the title once the headline scrolls under it. */
    val headline: Modifier,
    val disclosures: Disclosures,
    val twoPages: Boolean,
)

/** A part of a catalog page. On an open book, [trailing] ones read on the page after the fold: what the page covers, and its way in again. */
internal class CatalogBlock(
    val key: String,
    val trailing: Boolean = false,
    val content: @Composable () -> Unit,
)

/** Brings a block of the list that shows this one into view, by key, as the course's “Try a lesson” brings the lesson to try. */
internal val LocalShowBlock = staticCompositionLocalOf<suspend (key: String) -> Unit> { {} }

/** Tells [reading] where the learner reads. */
@Composable
private fun BlockList(
    blocks: List<CatalogBlock>,
    state: LazyListState,
    reading: CatalogReading,
    margin: Dp,
    modifier: Modifier = Modifier,
) {
    val current by rememberUpdatedState(blocks)
    val show: suspend (String) -> Unit = { key ->
        val index = current.indexOfFirst { it.key == key }
        if (index >= 0) state.animateScrollToItem(index)
    }

    LaunchedEffect(state, reading) {
        snapshotFlow {
            state.layoutInfo.visibleItemsInfo
                .firstOrNull()
                ?.key to state.firstVisibleItemScrollOffset
        }.filter { (key) -> key != null }
            .distinctUntilChanged()
            // The first is where the list opened, not where the learner went.
            .drop(1)
            .collect { (key, offset) -> current.firstOrNull { it.key == key }?.let { reading.read(it, offset, current) } }
    }

    CompositionLocalProvider(LocalShowBlock provides show) {
        LazyColumn(
            state = state,
            modifier = modifier,
            contentPadding = PaddingValues(horizontal = margin, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(56.dp),
        ) {
            items(blocks, key = { it.key }, contentType = { it.key }) { it.content() }
        }
    }
}

/**
 * Where the learner reads a catalog page, by page of the book: the block at the top of each page
 * and how far into it. Folding or unfolding a book foldable recreates the window and moves blocks
 * between one column and two pages, so each page opens where it was read, and one column at the
 * page read last.
 */
internal class CatalogReading(
    private var leading: BlockPlace? = null,
    private var trailing: BlockPlace? = null,
    private var trailingLast: Boolean = false,
) {
    /** A list of [blocks], opened where it was read: a page of the book at its own place, one column at the page read last. */
    fun listState(blocks: List<CatalogBlock>): LazyListState {
        val places = if (trailingLast) listOf(trailing, leading) else listOf(leading, trailing)
        val opening =
            places.firstNotNullOfOrNull { place ->
                place?.let {
                    blocks.indexOfFirst { it.key == place.key }.takeIf { it >= 0 }?.let { index ->
                        LazyListState(index, place.offset)
                    }
                }
            }

        return opening ?: LazyListState()
    }

    /** [block] is at the top of a list of [blocks], [offset] into it. Read in one column, the other page opens at its top. */
    fun read(
        block: CatalogBlock,
        offset: Int,
        blocks: List<CatalogBlock>,
    ) {
        val oneColumn = blocks.any { it.trailing } && blocks.any { !it.trailing }
        val place = BlockPlace(block.key, offset)

        if (block.trailing) {
            trailing = place
            if (oneColumn) leading = null
        } else {
            leading = place
            if (oneColumn) trailing = null
        }
        trailingLast = block.trailing
    }

    companion object {
        val Saver: Saver<CatalogReading, Any> =
            listSaver(
                save = { listOf(it.leading?.key, it.leading?.offset, it.trailing?.key, it.trailing?.offset, it.trailingLast) },
                restore = {
                    CatalogReading(
                        leading = BlockPlace.of(it[0] as String?, it[1] as Int?),
                        trailing = BlockPlace.of(it[2] as String?, it[3] as Int?),
                        trailingLast = it[4] as Boolean,
                    )
                },
            )
    }
}

internal data class BlockPlace(
    val key: String,
    val offset: Int,
) {
    companion object {
        fun of(
            key: String?,
            offset: Int?,
        ): BlockPlace? = if (key == null || offset == null) null else BlockPlace(key, offset)
    }
}

/**
 * What the learner opened on a catalog page, by disclosure. Kept by the page above its lists, since
 * a fold moves blocks from one list to another and a block would forget what it kept itself.
 */
@Stable
internal class Disclosures(
    opened: Map<String, Boolean> = emptyMap(),
) {
    private val toggled = mutableStateMapOf<String, Boolean>().apply { putAll(opened) }

    fun isOpen(
        key: String,
        byDefault: Boolean,
    ): Boolean = toggled[key] ?: byDefault

    fun toggle(
        key: String,
        byDefault: Boolean,
    ) {
        toggled[key] = !isOpen(key, byDefault)
    }

    companion object {
        val Saver: Saver<Disclosures, Any> =
            listSaver(
                save = { it.toggled.flatMap { (key, open) -> listOf(key, open) } },
                restore = { saved -> Disclosures(saved.chunked(2).associate { (key, open) -> key as String to open as Boolean }) },
            )
    }
}

/** Main's page column (`max-w-5xl`): the outline and plan read in one column however wide the window. */
private val PAGE_WIDTH = 1040.dp

/** A page of an open book, like a phone, keeps a phone's margins. */
private val PANE_MARGIN = 16.dp
