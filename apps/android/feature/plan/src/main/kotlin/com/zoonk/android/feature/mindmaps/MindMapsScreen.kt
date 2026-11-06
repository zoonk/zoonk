package com.zoonk.android.feature.mindmaps

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.goalcontent.WithPlanGoal
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.NotFoundMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.PendingLabel
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.PageFold
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.PageSpan
import com.zoonk.android.ui.scaffold.onPageSpan
import com.zoonk.android.ui.scaffold.pageFold
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.GoalMindMap
import com.zoonk.api.models.GoalMindMaps
import kotlinx.coroutines.launch
import java.util.UUID

@Composable
fun MindMapsScreen(
    route: AppRoute.MindMaps,
    app: AppContainer,
    navigator: AppNavigator,
) {
    WithPlanGoal(app.learnerSummary.summary, navigator) { goal ->
        val host = mindMapsHost(app)
        if (host == null) {
            PageScaffold(onBack = { navigator.back() }) {
                NotFoundMessage(onGoHome = { navigator.showRoot(AppTab.Today) }, Modifier.padding(it))
            }
        } else {
            MindMapsContent(goal.id, host, navigator, subject = route.subject)
        }
    }
}

@Composable
internal fun MindMapsContent(
    goalId: UUID,
    host: MindMapsHost,
    navigator: AppNavigator,
    subject: String? = null,
) {
    val resource = host.store.list[goalId]
    val state by resource.collectShown()
    val scope = rememberCoroutineScope()
    val back: () -> Unit = { navigator.back() }

    when (val shown = state) {
        is LoadState.Loaded -> {
            val maps = host.maps(goalId)
            val requests by maps.requests.collectAsStateWithLifecycle()
            val drawable = shown.value.chapters.any { it.status != GoalMindMap.Status.READY }

            CompositionLocalProvider(LocalPrivatePictures provides host.pictures) {
                MindMapsPage(
                    mindMaps = shown.value,
                    requests = requests,
                    cap = if (drawable) host.cap() else null,
                    actions =
                        MindMapsActions(
                            back = back,
                            open = { navigator.open(AppRoute.MindMap(it.toString())) },
                            openChapter = { navigator.open(AppRoute.Chapter(it.toString())) },
                            keepStudying = { navigator.select(AppTab.Today) },
                            create = maps::create,
                            retry = maps::retry,
                        ),
                    navigator = navigator,
                    subject = subject,
                    follow = { chapterId, mapShown, local -> FollowWhileDrawn(maps, chapterId, mapShown, local) },
                )
            }
        }

        is LoadState.Failed -> {
            PageScaffold(onBack = back) { padding ->
                if (shown.error == ApiError.NotFound) {
                    NotFoundMessage(onGoHome = { navigator.showRoot(AppTab.Today) }, Modifier.padding(padding))
                } else {
                    LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } }, modifier = Modifier.padding(padding))
                }
            }
        }

        LoadState.Empty -> {
            PageScaffold(onBack = back) { NotFoundMessage(onGoHome = { navigator.showRoot(AppTab.Today) }, Modifier.padding(it)) }
        }

        LoadState.Idle, LoadState.Loading -> {
            PageScaffold(onBack = back) { PageLoading(Modifier.padding(it), MaterialTheme.colorScheme.tertiary) }
        }
    }
}

internal data class MindMapsActions(
    val back: () -> Unit,
    val open: (UUID) -> Unit,
    val openChapter: (UUID) -> Unit,
    val keepStudying: () -> Unit,
    val create: (UUID) -> Unit,
    val retry: (UUID) -> Unit,
)

/**
 * Main's mind maps page: the goal's maps by subject, one per finished chapter, each made on a tap.
 * It opens at [subject]'s maps the first time, as main's `#key` does; a return keeps where it was.
 */
@Composable
internal fun MindMapsPage(
    mindMaps: GoalMindMaps,
    requests: Map<UUID, MindMapLocal>,
    cap: Limit?,
    actions: MindMapsActions,
    navigator: AppNavigator,
    subject: String? = null,
    follow: @Composable (UUID, MindMapShown, MindMapLocal?) -> Unit = { _, _, _ -> },
) {
    val title = stringResource(R.string.navigation_mind_maps)
    val groups = groupBySubject(mindMaps.chapters)
    val gridState = rememberLazyGridState(initialFirstVisibleItemIndex = groups.gridIndexOf(subject) ?: 0)
    val drawn = mindMaps.chapters.count { it.status == GoalMindMap.Status.READY }
    val capped = cap != null && drawn < mindMaps.chapters.size

    var span by remember { mutableStateOf<PageSpan?>(null) }

    PageScaffold(onBack = actions.back, title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) }) { padding ->
        BoxWithConstraints(Modifier.fillMaxSize().onPageSpan { span = it }) {
            val direction = LocalLayoutDirection.current
            val start = padding.calculateStartPadding(direction) + MARGIN
            val grid = tileGrid(maxWidth, pageFold(maxWidth, span), start, LocalDensity.current.fontScale.coerceAtLeast(1f))
            LazyVerticalGrid(
                columns = grid.columns,
                state = gridState,
                contentPadding =
                    PaddingValues(
                        start = start,
                        top = padding.calculateTopPadding() + 8.dp,
                        end = padding.calculateEndPadding(direction) + MARGIN,
                        bottom = padding.calculateBottomPadding() + 32.dp,
                    ),
                horizontalArrangement = grid.arrangement,
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                fullWidth("hero", grid.beforeFold) { MindMapsHero(mindMaps, drawn, if (capped) cap else null, navigator) }

                if (groups.isEmpty()) {
                    fullWidth("empty", grid.beforeFold) { MindMapsEmpty(mindMaps, actions, Modifier.padding(top = 12.dp)) }
                }

                groups.forEach { group ->
                    fullWidth("group-${group.key}", grid.beforeFold) { GroupTitle(group) }
                    items(group.maps.size, key = { group.maps[it].chapterId }, contentType = { "tile" }) { index ->
                        val map = group.maps[index]
                        val local = requests[map.chapterId]
                        val shown = shownMindMap(map.status.shown, local)
                        follow(map.chapterId, shown, local)
                        MapTile(map, shown, local, capped, actions, navigator)
                    }
                }
            }
        }
    }
}

/** Where [subject]'s title sits in the grid: after the hero, each group is its title and then its maps. */
internal fun List<MindMapGroup>.gridIndexOf(subject: String?): Int? {
    var index = 1
    for (group in this) {
        if (group.key == subject) return index
        index += 1 + group.maps.size
    }
    return null
}

private fun LazyGridScope.fullWidth(
    key: String,
    modifier: Modifier,
    content: @Composable () -> Unit,
) {
    item(key = key, span = { GridItemSpan(maxLineSpan) }, contentType = key) { Box(modifier) { content() } }
}

/** How the tiles lay out, and where what spans the grid keeps to: the page before a fold. */
private class TileGrid(
    val columns: GridCells,
    val arrangement: Arrangement.Horizontal,
    val beforeFold: Modifier,
)

/**
 * Main's grid on a page [width] wide whose grid starts [start] from its edge, its tiles growing with the text past its
 * default size ([textScale]). Across a book's [fold] each page holds the tiles a row its width allows, as many and as
 * wide on both, with the fold between them, so folding moves nothing.
 */
private fun tileGrid(
    width: Dp,
    fold: PageFold?,
    start: Dp,
    textScale: Float,
): TileGrid {
    val tileMin = TILE_MIN * textScale
    if (fold == null) {
        val columns = if (width < WIDE_FROM) GridCells.Fixed(narrowColumns(width - MARGIN * 2, textScale)) else GridCells.Adaptive(tileMin)
        return TileGrid(columns, Arrangement.spacedBy(tileSpacing(width)), Modifier)
    }

    val leading = fold.start - start - MARGIN
    val page = minOf(fold.start, width - fold.end)
    val spacing = tileSpacing(page)
    val room = page - MARGIN * 2
    val perPage =
        if (page < WIDE_FROM) narrowColumns(room, textScale) else ((room + spacing) / (tileMin + spacing)).toInt().coerceAtLeast(1)
    val around = AroundFold(leading, gap = fold.end - fold.start + MARGIN * 2, perPage, spacing)

    return TileGrid(around, around, Modifier.wrapContentWidth(Alignment.Start).width(leading))
}

private fun tileSpacing(width: Dp): Dp = if (width < WIDE_FROM) 12.dp else 16.dp

/**
 * Main's two tiles a row on a phone, where [room] is at least the narrowest phone's, scaled with the text. A narrower
 * room, such as a book's page beside the rail or a phone at a large text size, holds one, so a tile keeps room for its
 * button's label.
 */
private fun narrowColumns(
    room: Dp,
    textScale: Float,
): Int = if (room >= (NARROWEST_PHONE - MARGIN * 2) * textScale) 2 else 1

/**
 * [perPage] tiles a page on each side of a fold, all as wide, the ones before it ending at [leading] and the ones after
 * it starting [gap] later. A page wider than the other keeps its extra room at its outer edge, so the rows line up.
 */
private data class AroundFold(
    private val leading: Dp,
    private val gap: Dp,
    private val perPage: Int,
    override val spacing: Dp,
) : GridCells,
    Arrangement.Horizontal {
    override fun Density.calculateCrossAxisCellSizes(
        availableSize: Int,
        spacing: Int,
    ): List<Int> {
        val before = leading.roundToPx()
        val room = minOf(before, availableSize - before - gap.roundToPx())
        return List(perPage * 2) { ((room - spacing * (perPage - 1)) / perPage).coerceAtLeast(0) }
    }

    override fun Density.arrange(
        totalSize: Int,
        sizes: IntArray,
        layoutDirection: LayoutDirection,
        outPositions: IntArray,
    ) {
        val step = sizes.first() + spacing.roundToPx()
        val beforeFold = leading.roundToPx() - perPage * step + spacing.roundToPx()
        val afterFold = leading.roundToPx() + gap.roundToPx()
        sizes.indices.forEach { index ->
            outPositions[index] = if (index < perPage) beforeFold + index * step else afterFold + (index - perPage) * step
        }
    }
}

@Composable
private fun MindMapsHero(
    mindMaps: GoalMindMaps,
    drawn: Int,
    cap: Limit?,
    navigator: AppNavigator,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Eyebrow(mindMaps.goal.title)
        Text(
            stringResource(R.string.navigation_mind_maps),
            Modifier.pageTitle(),
            style = MaterialTheme.typography.headlineMedium,
        )
        if (mindMaps.chapters.isNotEmpty()) {
            Text(
                pluralStringResource(R.plurals.mindmaps_count, drawn, formatNumber(drawn.toDouble(), currentLocale())),
                Modifier.padding(top = 4.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.zoonkType.data,
            )
        }
        if (cap != null) MindMapLimit(cap, navigator, Modifier.padding(top = 16.dp))
    }
}

@Composable
private fun GroupTitle(group: MindMapGroup) {
    SectionHeader(
        group.name ?: stringResource(R.string.mindmaps_chapters_finished),
        Modifier.padding(top = 12.dp),
        detail = pluralStringResource(R.plurals.mindmaps_chapter_count, group.maps.size, group.maps.size),
    )
}

@Composable
internal fun MindMapsEmpty(
    mindMaps: GoalMindMaps,
    actions: MindMapsActions,
    modifier: Modifier = Modifier,
) {
    val next = mindMaps.nextChapter

    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(stringResource(R.string.mindmaps_empty_title), style = MaterialTheme.typography.titleSmall)
        Text(
            stringResource(R.string.mindmaps_empty_description),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        if (next != null) {
            Text(
                pluralStringResource(R.plurals.mindmaps_first_after, next.lessonsLeft.toInt(), next.title, next.lessonsLeft.toInt()),
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        OutlinedButton(
            onClick = { if (next != null) actions.openChapter(next.chapterId) else actions.keepStudying() },
            modifier = Modifier.padding(top = 8.dp),
        ) {
            Text(stringResource(if (next != null) R.string.mindmaps_continue else R.string.mindmaps_keep_studying))
        }
    }
}

@Composable
private fun MapTile(
    map: GoalMindMap,
    shown: MindMapShown,
    local: MindMapLocal?,
    capped: Boolean,
    actions: MindMapsActions,
    navigator: AppNavigator,
) {
    val image = map.image

    when {
        shown != MindMapShown.Ready -> {
            RequestTile(map, shown, local, capped, actions, navigator)
        }

        image != null -> {
            TileFrame(map, onClick = { actions.open(map.chapterId) }, onClickLabel = stringResource(R.string.mindmaps_full_screen)) {
                MapPicture(image.thumbnailUrl, contentDescription = null, Modifier.fillMaxSize())
            }
        }

        else -> {
            TileFrame(map, onClick = { actions.openChapter(map.chapterId) }) {
                Column(
                    Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(painterResource(R.drawable.ic_lan), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        stringResource(R.string.mindmaps_as_text),
                        Modifier.padding(top = 8.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }
    }
}

/** A square on a hairline with the chapter's number and title under it; the whole tile is one tap. */
@Composable
private fun TileFrame(
    map: GoalMindMap,
    onClick: () -> Unit,
    onClickLabel: String? = null,
    square: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier.clip(TILE_SHAPE).clickable(onClickLabel = onClickLabel, onClick = onClick),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(TILE_SHAPE)
                .border(BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), TILE_SHAPE),
        ) { square() }
        TileCaption(map)
    }
}

@Composable
private fun TileCaption(map: GoalMindMap) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            stringResource(R.string.mindmaps_chapter_number, formatNumber(map.position.toDouble(), currentLocale())),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium,
        )
        Text(map.title, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun RequestTile(
    map: GoalMindMap,
    shown: MindMapShown,
    local: MindMapLocal?,
    capped: Boolean,
    actions: MindMapsActions,
    navigator: AppNavigator,
) {
    val failure = shown == MindMapShown.Failed || shown == MindMapShown.Unreachable
    val limit = local?.limit
    val blocked = capped || (limit != null && limit !is Limit.SlowDown)
    val dash = MaterialTheme.colorScheme.outline

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .squareOrTaller()
                    .drawBehind {
                        drawRoundRect(
                            color = dash,
                            cornerRadius = CornerRadius(TILE_CORNER.toPx()),
                            style =
                                Stroke(
                                    width = 1.dp.toPx(),
                                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(6.dp.toPx(), 4.dp.toPx())),
                                ),
                        )
                    }.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(painterResource(R.drawable.ic_lan), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)

            if (shown == MindMapShown.Generating) {
                Row(
                    modifier = Modifier.semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(Modifier.size(14.dp), color = MaterialTheme.colorScheme.onSurfaceVariant, strokeWidth = 2.dp)
                    Text(
                        stringResource(R.string.mindmaps_drawing),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            } else {
                val spoken = stringResource(if (failure) R.string.mindmaps_try_again_spoken else R.string.mindmaps_create_spoken, map.title)
                OutlinedButton(
                    onClick = { if (failure) actions.retry(map.chapterId) else actions.create(map.chapterId) },
                    modifier = Modifier.semantics { contentDescription = spoken },
                    enabled = local?.pending != true && !blocked,
                ) {
                    PendingLabel(
                        local?.pending == true,
                        stringResource(if (failure) R.string.mindmaps_try_again else R.string.mindmaps_create),
                    )
                }
            }
        }

        TileCaption(map)

        if (failure) {
            Text(
                stringResource(if (shown == MindMapShown.Failed) R.string.mindmaps_failed_short else R.string.mindmaps_unreachable_short),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        if (limit != null && !capped && !local.pending) {
            MindMapLimit(limit, navigator, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        }
    }
}

/** As tall as it's wide, or taller where its content needs it, as large text can. */
private fun Modifier.squareOrTaller(): Modifier =
    layout { measurable, constraints ->
        val placeable =
            measurable.measure(
                constraints.copy(minHeight = constraints.maxWidth.coerceIn(constraints.minHeight, constraints.maxHeight)),
            )
        layout(placeable.width, placeable.height) { placeable.place(0, 0) }
    }

private val TILE_CORNER = ZoonkRadius.option
private val TILE_SHAPE = RoundedCornerShape(TILE_CORNER)
private val TILE_MIN = 208.dp
private val MARGIN = 16.dp

/** Main's `sm`: two tiles a row on a phone, then as many 13rem tiles as fit. */
private val WIDE_FROM = 600.dp

private val NARROWEST_PHONE = 320.dp
