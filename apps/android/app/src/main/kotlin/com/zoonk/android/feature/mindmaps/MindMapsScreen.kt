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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.goalcontent.PageLoading
import com.zoonk.android.feature.goalcontent.PageNotFound
import com.zoonk.android.feature.plan.planGoal
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.PrivatePictures
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.GoalMindMap
import com.zoonk.api.models.GoalMindMaps
import kotlinx.coroutines.launch
import java.util.UUID

@Composable
fun MindMapsScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val goal = summary.value?.planGoal
    val host = mindMapsHost(app)

    if (goal == null || host == null) {
        PageScaffold(onBack = { navigator.back() }) { PageNotFound(navigator, it) }
        return
    }

    MindMapsContent(goal.id, host, navigator)
}

@Composable
internal fun MindMapsContent(
    goalId: UUID,
    host: MindMapsHost,
    navigator: AppNavigator,
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
                    follow = { chapterId, mapShown, local -> FollowWhileDrawn(maps, chapterId, mapShown, local) },
                )
            }
        }

        is LoadState.Failed -> {
            PageScaffold(onBack = back) { padding ->
                if (shown.error == ApiError.NotFound) {
                    PageNotFound(navigator, padding)
                } else {
                    LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } }, modifier = Modifier.padding(padding))
                }
            }
        }

        LoadState.Empty -> {
            PageScaffold(onBack = back) { PageNotFound(navigator, it) }
        }

        LoadState.Idle, LoadState.Loading -> {
            PageScaffold(onBack = back) { PageLoading(it) }
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

/** Main's mind maps page: the goal's maps by subject, one per finished chapter, each made on a tap. */
@Composable
internal fun MindMapsPage(
    mindMaps: GoalMindMaps,
    requests: Map<UUID, MindMapLocal>,
    cap: Limit?,
    actions: MindMapsActions,
    navigator: AppNavigator,
    follow: @Composable (UUID, MindMapShown, MindMapLocal?) -> Unit = { _, _, _ -> },
) {
    val title = stringResource(R.string.navigation_mind_maps)
    val gridState = rememberLazyGridState()
    val titleAway by remember { derivedStateOf { gridState.firstVisibleItemIndex > 0 } }
    val drawn = mindMaps.chapters.count { it.status == GoalMindMap.Status.READY }
    val capped = cap != null && drawn < mindMaps.chapters.size
    val groups = groupBySubject(mindMaps.chapters)

    PageScaffold(onBack = actions.back, title = { if (titleAway) Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) }) { padding ->
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val direction = LocalLayoutDirection.current
            LazyVerticalGrid(
                columns = if (maxWidth < WIDE_FROM) GridCells.Fixed(2) else GridCells.Adaptive(TILE_MIN),
                state = gridState,
                contentPadding =
                    PaddingValues(
                        start = padding.calculateStartPadding(direction) + 16.dp,
                        top = padding.calculateTopPadding() + 8.dp,
                        end = padding.calculateEndPadding(direction) + 16.dp,
                        bottom = padding.calculateBottomPadding() + 32.dp,
                    ),
                horizontalArrangement = Arrangement.spacedBy(if (maxWidth < WIDE_FROM) 12.dp else 16.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                fullWidth("hero") { MindMapsHero(mindMaps, drawn, if (capped) cap else null, navigator) }

                if (groups.isEmpty()) fullWidth("empty") { MindMapsEmpty(mindMaps, actions, Modifier.padding(top = 12.dp)) }

                groups.forEach { group ->
                    fullWidth("group-${group.key}") { GroupTitle(group) }
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

private fun LazyGridScope.fullWidth(
    key: String,
    content: @Composable () -> Unit,
) {
    item(key = key, span = { GridItemSpan(maxLineSpan) }, contentType = key) { content() }
}

@Composable
private fun MindMapsHero(
    mindMaps: GoalMindMaps,
    drawn: Int,
    cap: Limit?,
    navigator: AppNavigator,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(mindMaps.goal.title, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
        Text(
            stringResource(R.string.navigation_mind_maps),
            Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleLarge,
        )
        if (mindMaps.chapters.isNotEmpty()) {
            Text(
                pluralStringResource(R.plurals.mindmaps_count, drawn, formatNumber(drawn.toDouble(), currentLocale())),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium.copy(fontFeatureSettings = "tnum"),
            )
        }
        if (cap != null) MindMapLimit(cap, navigator, Modifier.padding(top = 16.dp))
    }
}

@Composable
private fun GroupTitle(group: MindMapGroup) {
    Row(Modifier.padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = group.name ?: stringResource(R.string.mindmaps_chapters_finished),
            modifier = Modifier.weight(1f).semantics { heading() },
            style = MaterialTheme.typography.titleMedium,
        )
        Text(
            pluralStringResource(R.plurals.mindmaps_chapter_count, group.maps.size, group.maps.size),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
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
        FilledTonalButton(
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
            val alt = stringResource(R.string.mindmaps_alt_chapter, map.title)
            TileFrame(map, onClick = { actions.open(map.chapterId) }) {
                MapPicture(image.thumbnailUrl, alt, Modifier.fillMaxSize())
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
    square: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier.clip(TILE_SHAPE).clickable(onClick = onClick),
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
                    .aspectRatio(1f)
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
                FilledTonalButton(
                    onClick = { if (failure) actions.retry(map.chapterId) else actions.create(map.chapterId) },
                    enabled = local?.pending != true && !blocked,
                ) {
                    Text(stringResource(if (failure) R.string.mindmaps_try_again else R.string.mindmaps_create))
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
        if (limit != null && !capped) MindMapLimit(limit, navigator)
    }
}

private val TILE_CORNER = 12.dp
private val TILE_SHAPE = RoundedCornerShape(TILE_CORNER)
private val TILE_MIN = 208.dp

/** Main's `sm`: two tiles a row on a phone, then as many 13rem tiles as fit. */
private val WIDE_FROM = 600.dp
