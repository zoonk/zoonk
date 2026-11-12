package com.zoonk.android.feature.mindmaps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.goalcontent.WithPlanGoal
import com.zoonk.android.feature.subscription.PlusNotice
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.EmptyState
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.NotFoundMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.bleed
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

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
            val saves by maps.saves.collectAsStateWithLifecycle()
            val createAll by maps.createAll.collectAsStateWithLifecycle()
            val makeable = shown.value.chapters.any { it.status == GoalMindMap.Status.AVAILABLE }

            FollowListWhileOnItsWay(resource, shown.value.chapters, requests)

            CompositionLocalProvider(LocalPrivatePictures provides host.pictures) {
                MindMapsPage(
                    mindMaps = shown.value,
                    state = MindMapsState(requests, saves, createAll, if (makeable) host.cap() else null, host.plus(), host.tier()),
                    actions =
                        MindMapsActions(
                            back = back,
                            keepStudying = { navigator.select(AppTab.Today) },
                            create = maps::create,
                            createAll = maps::createAll,
                            save = maps::save,
                            navigate = navigator::open,
                            study = { tab, place -> navigator.open(AppRoute.MindMapStudy(goalId.toString(), tab.key, place?.start)) },
                        ),
                    subject = subject,
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

/**
 * One follower for the whole page while maps are on their way: the list again every 5 seconds while
 * one is drawn, every 15 while only lessons are written, only while the screen is started.
 */
@Composable
private fun FollowListWhileOnItsWay(
    resource: Resource<GoalMindMaps>,
    chapters: List<GoalMindMap>,
    requests: Map<UUID, MindMapLocal>,
) {
    val every = listCadence(chapters, requests.values.any { it.pending }) ?: return
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(resource, lifecycle, every) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                delay(every)
                resource.refresh()
            }
        }
    }
}

/** How often the list asks again: drawing takes half a minute, writing lessons minutes; null when nothing is on its way. */
internal fun listCadence(
    chapters: List<GoalMindMap>,
    pending: Boolean,
): Duration? =
    when {
        pending || chapters.any { it.status == GoalMindMap.Status.DRAWING } -> 5.seconds
        chapters.any { it.status == GoalMindMap.Status.WRITING_LESSONS } -> 15.seconds
        else -> null
    }

/** What the page shows besides the list: taps on their way, the plan's cap on new maps, and the learner's plan. */
internal data class MindMapsState(
    val requests: Map<UUID, MindMapLocal> = emptyMap(),
    val saves: Map<MindMapTarget, Boolean> = emptyMap(),
    val createAll: CreateAll? = null,
    val cap: Limit? = null,
    val plus: Boolean = false,
    val tier: LimitTier = LimitTier.Free,
)

internal data class MindMapsActions(
    val back: () -> Unit,
    val keepStudying: () -> Unit,
    val create: (UUID) -> Unit,
    val navigate: (AppRoute) -> Unit,
    val createAll: () -> Unit = {},
    val save: (target: MindMapTarget, chapterId: UUID?, saved: Boolean) -> Unit = { _, _, _ -> },
    val study: (tab: StudyTab, place: MapPlace?) -> Unit = { _, _ -> },
)

/**
 * Main's Mind maps page: the goal, Study, and three tabs (chapters' maps, lessons' maps and the saved
 * ones), each a bounded index of the maps that exist; the chapters whose maps aren't made yet end the
 * Chapters tab. It opens at the tab the server picks, and the first time at [subject]'s maps there,
 * unfolded, as main's `?subject=` does.
 */
@Composable
internal fun MindMapsPage(
    mindMaps: GoalMindMaps,
    state: MindMapsState,
    actions: MindMapsActions,
    subject: String? = null,
    initialTab: StudyTab? = null,
    notMadeShown: Boolean = false,
) {
    var picked by rememberSaveable { mutableStateOf(initialTab?.key) }
    val tab = StudyTab.of(picked) ?: mindMaps.firstTab.tab
    var opened by rememberSaveable { mutableStateOf(listOfNotNull(subject)) }
    var showAll by rememberSaveable { mutableStateOf(emptyList<String>()) }
    var notMadeOpen by rememberSaveable { mutableStateOf(notMadeShown) }
    val decks = StudyTab.entries.associateWith { mindMaps.deck(it).size }
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = mindMaps.subjectItem(tab, subject) ?: 0)
    val title = stringResource(R.string.navigation_mind_maps)

    val tabActions =
        TabActions(
            page = actions,
            state = state,
            toggleSubject = { key -> opened = if (key in opened) opened - key else opened + key },
            showAll = { showAll = showAll + tab.key },
            toggleNotMade = { notMadeOpen = !notMadeOpen },
        )

    PageScaffold(onBack = actions.back, title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) }) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            BeforeFold { beforeFold ->
                LazyColumn(beforeFold.widthIn(max = DETAIL_PAGE_WIDTH).fillMaxSize(), listState, detailPagePadding()) {
                    item(key = "hero", contentType = "hero") {
                        MindMapsHeader(mindMaps, study = { actions.study(tab, null) }.takeIf { decks.getValue(tab) > 0 }, actions.navigate)
                    }
                    stickyHeader(key = "tabs", contentType = "tabs") { MindMapsTabs(tab, decks) { picked = it.key } }

                    val shown = IndexState(opened.toSet(), tab.key in showAll)
                    when (tab) {
                        StudyTab.Chapters -> chaptersTab(mindMaps, shown, notMadeOpen, tabActions)
                        StudyTab.Lessons -> lessonsTab(mindMaps, shown, tabActions)
                        StudyTab.Saved -> savedTab(mindMaps, shown, tabActions)
                    }
                }
            }
        }
    }
}

/** The hero and the tabs come before a tab's index. */
private const val ITEMS_BEFORE_INDEX = 2

/** Where [subject]'s title sits in [tab]'s list as the page opens, with its maps unfolded; null when the tab doesn't list it. */
internal fun GoalMindMaps.subjectItem(
    tab: StudyTab,
    subject: String?,
): Int? {
    val opened = setOfNotNull(subject)
    val entries =
        when (tab) {
            StudyTab.Chapters -> boundedIndex(chapterIndex(), opened, showAll = false)
            StudyTab.Lessons -> boundedIndex(lessonIndex(), opened, showAll = false)
            StudyTab.Saved -> return null
        }
    val at = entries.indexOfFirst { it is IndexEntry.Subject && it.key == subject }
    return if (at < 0) null else ITEMS_BEFORE_INDEX + at
}

internal data class IndexState(
    val opened: Set<String>,
    val showAll: Boolean,
)

internal class TabActions(
    val page: MindMapsActions,
    val state: MindMapsState,
    val toggleSubject: (String) -> Unit,
    val showAll: () -> Unit,
    val toggleNotMade: () -> Unit,
) {
    fun saved(
        target: MindMapTarget,
        server: Boolean,
    ) = state.saves[target] ?: server
}

/** The goal over the title, then Study, which opens the tab's maps where this device stopped; and why rows are locked for Plus. */
@Composable
private fun MindMapsHeader(
    mindMaps: GoalMindMaps,
    study: (() -> Unit)?,
    navigate: (AppRoute) -> Unit,
) {
    Column(Modifier.padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Eyebrow(mindMaps.goal.displayName)
        Text(stringResource(R.string.navigation_mind_maps), Modifier.pageTitle(), style = MaterialTheme.typography.headlineMedium)
        if (study != null) {
            Button(
                onClick = study,
                modifier = Modifier.padding(top = 12.dp),
                leadingIcon = { ButtonIcon(R.drawable.ic_play_arrow) },
            ) { Text(stringResource(R.string.mindmaps_study)) }
        }
        if (mindMaps.chapters.any { it.status == GoalMindMap.Status.PLUS_REQUIRED }) {
            PlusNotice(
                onSeePlus = { navigate(AppRoute.Subscription) },
                modifier = Modifier.padding(top = 12.dp),
                title = stringResource(R.string.subscription_free_week_over_title),
                description = stringResource(R.string.subscription_free_week_over_description),
            )
        }
    }
}

/** Material's tabs, each with how many maps Study would open there. */
@Composable
private fun MindMapsTabs(
    tab: StudyTab,
    decks: Map<StudyTab, Int>,
    onPick: (StudyTab) -> Unit,
) {
    PrimaryTabRow(
        selectedTabIndex = tab.ordinal,
        modifier = Modifier.bleed(LIST_ITEM_INSET).fillMaxWidth(),
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        StudyTab.entries.forEach { each ->
            val label = stringResource(each.label)
            val count = decks.getValue(each)
            val number = formatNumber(count.toDouble(), currentLocale())
            val spoken = pluralStringResource(R.plurals.mindmaps_tab_spoken, count, label, number)
            Tab(
                selected = each == tab,
                onClick = { onPick(each) },
                text = {
                    FlowRow(
                        Modifier.clearAndSetSemantics { contentDescription = spoken },
                        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
                    ) {
                        Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(
                            number,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.zoonkType.data,
                            softWrap = false,
                        )
                    }
                },
                selectedContentColor = MaterialTheme.colorScheme.onSurface,
                unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

private val StudyTab.label: Int
    get() =
        when (this) {
            StudyTab.Chapters -> R.string.mindmaps_tab_chapters
            StudyTab.Lessons -> R.string.mindmaps_tab_lessons
            StudyTab.Saved -> R.string.mindmaps_tab_saved
        }

/** A tab's index: subjects' titles (folding once it's long), its rows, and Show all. */
internal fun <T> LazyListScope.index(
    tab: StudyTab,
    entries: List<IndexEntry<T>>,
    actions: TabActions,
    rowKey: (T) -> String,
    row: @Composable (T, divided: Boolean) -> Unit,
) {
    itemsIndexed(
        entries,
        key = { _, entry ->
            when (entry) {
                is IndexEntry.Subject -> "${tab.key}-subject-${entry.key}"
                is IndexEntry.Row -> "${tab.key}-${rowKey(entry.row)}"
                is IndexEntry.ShowAll -> "${tab.key}-all"
            }
        },
        contentType = { _, entry -> entry::class.simpleName },
    ) { index, entry ->
        when (entry) {
            is IndexEntry.Subject -> SubjectTitle(entry, actions.toggleSubject)
            is IndexEntry.Row -> row(entry.row, index > 0 && entries[index - 1] is IndexEntry.Row)
            is IndexEntry.ShowAll -> ShowAll(entry.count, actions.showAll)
        }
    }
}

@Composable
private fun SubjectTitle(
    subject: IndexEntry.Subject,
    toggle: (String) -> Unit,
) {
    val count = pluralStringResource(R.plurals.mindmaps_chapter_count, subject.count, subject.count)
    val open = subject.open
    if (open == null) {
        SectionHeader(subject.name, Modifier.padding(top = 24.dp, bottom = 8.dp), detail = count)
    } else {
        ListRow(
            headline = { Text(subject.name, style = MaterialTheme.zoonkType.sectionTitle) },
            modifier = Modifier.bleed(LIST_ITEM_INSET).padding(top = 8.dp),
            onClick = { toggle(subject.key) },
            expanded = open,
            meta = { Text(count) },
        )
    }
}

@Composable
private fun ShowAll(
    count: Int,
    onClick: () -> Unit,
) {
    ListRow(
        headline = { Text(stringResource(R.string.mindmaps_show_all, formatNumber(count.toDouble(), currentLocale()))) },
        modifier = Modifier.bleed(LIST_ITEM_INSET).padding(top = 4.dp),
        onClick = onClick,
        expanded = false,
    )
}

/** A row's hairline above it, under the row before it. */
@Composable
internal fun Divided(
    divided: Boolean,
    content: @Composable () -> Unit,
) {
    Column(Modifier.bleed(LIST_ITEM_INSET).background(MaterialTheme.colorScheme.surface)) {
        if (divided) HorizontalDivider()
        content()
    }
}

@Composable
internal fun TabEmpty(
    icon: Int,
    title: Int,
    description: Int,
    action: (@Composable () -> Unit)? = null,
) {
    EmptyState(
        icon = icon,
        title = stringResource(title),
        description = stringResource(description),
        modifier = Modifier.padding(top = 24.dp),
        action = action,
    )
}

@Composable
internal fun KeepStudying(onClick: () -> Unit) {
    OutlinedButton(onClick = onClick) { Text(stringResource(R.string.mindmaps_keep_studying)) }
}
