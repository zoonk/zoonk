package com.zoonk.android.feature.mindmaps

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.goalcontent.WithPlanGoal
import com.zoonk.android.feature.subscription.PlusNotice
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.EmptyState
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.NotFoundMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.limitMessage
import com.zoonk.android.ui.components.needsAccount
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.DETAIL_PAGE_WIDTH
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.detailPagePadding
import com.zoonk.android.ui.scaffold.pageTitle
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
            val makeable = shown.value.chapters.any { it.status == GoalMindMap.Status.AVAILABLE }

            CompositionLocalProvider(LocalPrivatePictures provides host.pictures) {
                MindMapsPage(
                    mindMaps = shown.value,
                    requests = requests,
                    cap = if (makeable) host.cap() else null,
                    plus = host.plus(),
                    actions =
                        MindMapsActions(
                            back = back,
                            keepStudying = { navigator.select(AppTab.Today) },
                            create = maps::create,
                            retry = maps::retry,
                            navigate = navigator::open,
                        ),
                    subject = subject,
                    follow = { chapterId, mapShown -> FollowWhileOnItsWay(maps, chapterId, mapShown) },
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
    val keepStudying: () -> Unit,
    val create: (UUID) -> Unit,
    val retry: (UUID) -> Unit,
    val navigate: (AppRoute) -> Unit,
)

/**
 * Main's Mind maps page: a row for every chapter of the plan that can have a map, by subject in
 * the plan's order. It opens at [subject]'s group the first time, as main's `#key` does; a return
 * keeps where it was.
 */
@Composable
internal fun MindMapsPage(
    mindMaps: GoalMindMaps,
    requests: Map<UUID, MindMapLocal>,
    cap: Limit?,
    plus: Boolean,
    actions: MindMapsActions,
    subject: String? = null,
    follow: @Composable (UUID, MindMapShown) -> Unit = { _, _ -> },
) {
    val title = stringResource(R.string.navigation_mind_maps)
    val groups = groupBySubject(mindMaps.chapters)
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = groups.listIndexOf(subject) ?: 0)
    val drawn = mindMaps.chapters.count { it.status == GoalMindMap.Status.READY }

    PageScaffold(onBack = actions.back, title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) }) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            BeforeFold { beforeFold ->
                LazyColumn(beforeFold.widthIn(max = DETAIL_PAGE_WIDTH).fillMaxSize(), listState, detailPagePadding()) {
                    item(key = "hero", contentType = "hero") { MindMapsHero(mindMaps, drawn, cap, plus, actions.navigate) }

                    if (groups.isEmpty()) {
                        item(key = "empty", contentType = "empty") { MindMapsEmpty(actions, Modifier.padding(top = 24.dp)) }
                    }

                    groups.forEach { group -> mapGroup(group, requests, cap, plus, actions, follow) }
                }
            }
        }
    }
}

private fun LazyListScope.mapGroup(
    group: MindMapGroup,
    requests: Map<UUID, MindMapLocal>,
    cap: Limit?,
    plus: Boolean,
    actions: MindMapsActions,
    follow: @Composable (UUID, MindMapShown) -> Unit,
) {
    group.name?.let { name ->
        item(key = "group-${group.key}", contentType = "group") {
            SectionHeader(
                name,
                Modifier.padding(top = 24.dp, bottom = 8.dp),
                detail = pluralStringResource(R.plurals.mindmaps_chapter_count, group.maps.size, group.maps.size),
            )
        }
    }
    itemsIndexed(group.maps, key = { _, map -> map.chapterId }, contentType = { _, _ -> "map" }) { index, map ->
        val local = requests[map.chapterId]
        val shown = shownMindMap(map.status.shown, local)
        follow(map.chapterId, shown)
        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            if (index > 0) HorizontalDivider()
            MindMapRow(
                map = map.facts,
                place = MindMapPlace.Library,
                shown = shown,
                local = local,
                cap = cap.takeIf { shown == MindMapShown.Available },
                plus = plus,
                actions = MindMapRowActions({ actions.create(map.chapterId) }, { actions.retry(map.chapterId) }, actions.navigate),
            )
        }
    }
}

/** Where [subject]'s title sits in the list: after the hero, each group is its title and then its maps. */
internal fun List<MindMapGroup>.listIndexOf(subject: String?): Int? {
    var index = 1
    for (group in this) {
        if (group.key == subject && group.name != null) return index
        index += (if (group.name != null) 1 else 0) + group.maps.size
    }
    return null
}

/**
 * The goal over the title, how many maps are drawn, what maps are (and, while a row has lessons to
 * write, what making its map does, for the learner's [plus] or free plan), then once each: why rows
 * are locked for Plus, and the plan's cap.
 */
@Composable
private fun MindMapsHero(
    mindMaps: GoalMindMaps,
    drawn: Int,
    cap: Limit?,
    plus: Boolean,
    navigate: (AppRoute) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Eyebrow(mindMaps.goal.title)
        Text(stringResource(R.string.navigation_mind_maps), Modifier.pageTitle(), style = MaterialTheme.typography.headlineMedium)
        if (mindMaps.chapters.isNotEmpty()) {
            Text(
                pluralStringResource(R.plurals.mindmaps_count, drawn, formatNumber(drawn.toDouble(), currentLocale())),
                Modifier.padding(top = 4.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.zoonkType.data,
            )
        }
        Text(
            stringResource(mindMaps.intro(plus)),
            Modifier.padding(top = 8.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        val locked = mindMaps.chapters.any { it.status == GoalMindMap.Status.PLUS_REQUIRED }
        if (locked) {
            PlusNotice(
                onSeePlus = { navigate(AppRoute.Subscription) },
                modifier = Modifier.padding(top = 12.dp),
                title = stringResource(R.string.subscription_free_week_over_title),
                description = stringResource(R.string.subscription_free_week_over_description),
            )
        }
        when {
            cap == null -> {}

            // The Plus notice above already has the page's one See Plus.
            locked && !cap.needsAccount -> {
                Text(
                    limitMessage(cap, LimitSubject.MindMaps),
                    Modifier.padding(top = 12.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            else -> {
                MindMapLimit(cap, lessonsRanOut = false, navigate, Modifier.padding(top = 12.dp))
            }
        }
    }
}

/** The intro, saying once what writing a chapter's lessons first means while a row reads "Lessons not written yet". */
private fun GoalMindMaps.intro(plus: Boolean): Int =
    when {
        chapters.none { it.status == GoalMindMap.Status.AVAILABLE && it.lessonsToWrite > 0 } -> R.string.mindmaps_intro
        plus -> R.string.mindmaps_intro_lessons_first_plus
        else -> R.string.mindmaps_intro_lessons_first_free
    }

@Composable
private fun MindMapsEmpty(
    actions: MindMapsActions,
    modifier: Modifier = Modifier,
) {
    EmptyState(
        icon = R.drawable.ic_lan,
        title = stringResource(R.string.mindmaps_empty_title),
        description = stringResource(R.string.mindmaps_empty_description),
        modifier = modifier,
        action = { OutlinedButton(onClick = actions.keepStudying) { Text(stringResource(R.string.mindmaps_keep_studying)) } },
    )
}
