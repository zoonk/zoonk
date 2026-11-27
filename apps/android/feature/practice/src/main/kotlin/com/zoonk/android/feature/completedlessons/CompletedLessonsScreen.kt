package com.zoonk.android.feature.completedlessons

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.AppSnackbars
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.isSaved
import com.zoonk.android.data.value
import com.zoonk.android.feature.savedlessons.LessonRowBookmark
import com.zoonk.android.feature.savedlessons.LessonSaveRow
import com.zoonk.android.feature.savedlessons.SavedLessonsStore
import com.zoonk.android.feature.savedlessons.rememberLessonSaves
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.FilterChips
import com.zoonk.android.ui.components.FilterList
import com.zoonk.android.ui.components.FilterTab
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.LoadMoreFooter
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.PageTitleRow
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.listRowDescription
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.DETAIL_PAGE_WIDTH
import com.zoonk.android.ui.scaffold.DETAIL_SECTION_GAP
import com.zoonk.android.ui.scaffold.DetailPage
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.pagePadding
import com.zoonk.api.models.CompletedLesson
import com.zoonk.api.models.CompletedLessonFilter
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

@Composable
fun CompletedLessonsScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val read = summary.value
    val goalId = read?.activeGoalId
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val title = stringResource(R.string.navigation_completed_lessons)

    PageScaffold(
        onBack = { navigator.back() },
        title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                goalId != null -> {
                    // `finishedOn` is the goal's local day, and the summary is read again at its midnight.
                    val today = LocalDate.now(read.timeZone?.let(ZoneId::of) ?: ZoneId.systemDefault())
                    val goal = read.goals.firstOrNull { it.id == goalId }
                    CompletedLessons(goalId, today, app.completedLessons, app.savedLessons, app.snackbars, listState) {
                        navigator.open(AppRoute.Lesson(it.toString()))
                    }
                }

                summary is LoadState.Failed -> {
                    LoadFailedMessage(onRetry = { scope.launch { app.learnerSummary.summary.refresh() } })
                }

                read != null -> {
                    LaunchedEffect(Unit) { navigator.showRoot(AppTab.Today) }
                }

                else -> {
                    PageLoading()
                }
            }
        }
    }
}

/**
 * Newest first, a section per month, each lesson's day at its row's end. A list long enough to narrow
 * has its plan's groups as its filter: beside it where the page splits into panes, a row of chips
 * over it otherwise. The filter is the same whatever group shows, so it stays while a group's
 * lessons load.
 */
@Composable
internal fun CompletedLessons(
    goalId: UUID,
    today: LocalDate,
    store: CompletedLessonsStore,
    savedLessons: SavedLessonsStore,
    snackbars: AppSnackbars,
    listState: LazyListState,
    onOpen: (UUID) -> Unit,
) {
    val saves = rememberLessonSaves(savedLessons, goalId, snackbars)
    val states by saves.states.collectAsStateWithLifecycle()
    var group by rememberSaveable(goalId) { mutableStateOf<String?>(null) }
    val query = CompletedLessonsQuery(goalId, group)
    val resource = store.lessons[query]
    val state by resource.collectShown()
    val every by store.lessons[CompletedLessonsQuery(goalId)].collectShown()
    val scope = rememberCoroutineScope()
    val list = state.value
    val filter = (list ?: every.value)?.filter
    val nextCursor = list?.pagination?.nextCursor
    var loadingMore by remember(query) { mutableStateOf(false) }
    var moreFailed by rememberSaveable(query) { mutableStateOf(false) }
    val more = {
        if (!loadingMore) {
            loadingMore = true
            moreFailed = false
            scope.launch {
                moreFailed = !store.more(query)
                loadingMore = false
            }
        }
    }

    LaunchedEffect(listState, query, nextCursor) {
        snapshotFlow {
            listState.layoutInfo.visibleItemsInfo
                .lastOrNull()
                ?.index ?: 0
        }.distinctUntilChanged()
            .filter { last -> nextCursor != null && last >= listState.layoutInfo.totalItemsCount - 1 }
            .collect { if (!moreFailed) more() }
    }

    if (list == null && filter == null) {
        if (state is LoadState.Failed) LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } }) else PageLoading()
        return
    }

    val locale = currentLocale()
    val tabs = filter?.let { groupTabs(it, group) }
    val groupsTitle = filter?.let { stringResource(it.kind.title) }.orEmpty()
    val months = list?.`data`.orEmpty().groupBy { it.finishedOn.toJavaLocalDate().withDayOfMonth(1) }
    val content: LazyListScope.(Boolean) -> Unit = { groupsBeside ->
        item(key = "title", contentType = "title") {
            PageTitleRow(stringResource(R.string.navigation_completed_lessons))
        }

        if (tabs != null && !groupsBeside) {
            item(key = "groups", contentType = "groups") {
                FilterChips(tabs, groupsTitle, onSelect = { group = it }, Modifier.bleed(LIST_ITEM_INSET), counts = true)
            }
        }

        when {
            list == null && state is LoadState.Failed -> {
                item(key = "failed", contentType = "failed") {
                    LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } })
                }
            }

            list == null -> {
                item(key = "loading", contentType = "loading") { PageLoading(Modifier.fillParentMaxHeight(LOADING_SHARE)) }
            }

            months.isEmpty() -> {
                item(key = "empty", contentType = "empty") {
                    Text(
                        stringResource(R.string.completed_lessons_empty_description),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }

        months.forEach { (month, lessons) ->
            item(key = "month-$month", contentType = "month") {
                Column {
                    SectionHeader(
                        formatDate(month, locale, DateStyle.MonthName, today).replaceFirstChar { it.titlecase(locale) },
                        Modifier.padding(bottom = 8.dp),
                    )
                    lessons.forEachIndexed { index, lesson ->
                        val saved = states.isSaved(lesson.lessonId, lesson.saved)
                        LessonRow(lesson, first = index == 0, today, saved, onToggle = { saves.set(lesson.lessonId, !saved) }, onOpen)
                    }
                }
            }
        }

        if (nextCursor != null) {
            item(key = "more", contentType = "more") {
                LoadMoreFooter(
                    isLoading = loadingMore,
                    failed = moreFailed,
                    loadingLabel = stringResource(R.string.completed_lessons_loading_more),
                    failedText = stringResource(R.string.completed_lessons_load_more_failed),
                    onRetry = more,
                )
            }
        }
    }

    if (tabs == null) {
        BeforeFold { beforeFold ->
            LazyColumn(
                beforeFold.widthIn(max = DETAIL_PAGE_WIDTH).fillMaxSize(),
                listState,
                pagePadding(),
                verticalArrangement = Arrangement.spacedBy(DETAIL_SECTION_GAP),
            ) { content(false) }
        }
        return
    }

    DetailPage(
        aside = {
            Column {
                SectionHeader(groupsTitle, Modifier.padding(bottom = 8.dp))
                FilterList(tabs, groupsTitle, onSelect = { group = it }, Modifier.bleed(LIST_ITEM_INSET))
            }
        },
        asideLabel = groupsTitle,
        listState = listState,
        content = content,
    )
}

@Composable
private fun groupTabs(
    filter: CompletedLessonFilter,
    group: String?,
): List<FilterTab> {
    val shown = filter.groups.firstOrNull { it.key == group }?.key
    val all = FilterTab(null, stringResource(R.string.completed_lessons_all), filter.total, selected = shown == null)
    return listOf(all) + filter.groups.map { FilterTab(it.key, it.name, it.lessons, selected = it.key == shown) }
}

/** The plan's own word for its groups, as its Plan page titles them. */
private val CompletedLessonFilter.Kind.title: Int
    get() =
        when (this) {
            CompletedLessonFilter.Kind.SUBJECTS -> R.string.goalcontent_subjects
            CompletedLessonFilter.Kind.MODULES -> R.string.goalcontent_modules
            CompletedLessonFilter.Kind.PHASES -> R.string.onboarding_reveal_phases
        }

@Composable
private fun LessonRow(
    lesson: CompletedLesson,
    first: Boolean,
    today: LocalDate,
    saved: Boolean,
    onToggle: () -> Unit,
    onOpen: (UUID) -> Unit,
) {
    Column(Modifier.bleed(LIST_ITEM_INSET)) {
        if (!first) ListDivider()
        if (lesson.available) {
            LessonSaveRow(saved, onToggle) { longPressLabel, onLongPress ->
                LessonRowContent(
                    lesson,
                    today,
                    onClick = { onOpen(lesson.lessonId) },
                    onLongClickLabel = longPressLabel,
                    onLongClick = onLongPress,
                    trailing = { LessonRowBookmark(lesson.title, saved, onToggle) },
                )
            }
        } else {
            LessonRowContent(lesson, today)
        }
    }
}

@Composable
private fun LessonRowContent(
    lesson: CompletedLesson,
    today: LocalDate,
    onClick: (() -> Unit)? = null,
    onLongClickLabel: String? = null,
    onLongClick: (() -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    ListRow(
        headline = { Text(lesson.title) },
        supporting = listRowDescription(lesson.chapterTitle),
        meta = { Text(formatDate(lesson.finishedOn.toJavaLocalDate(), currentLocale(), DateStyle.Day, today)) },
        onClick = onClick,
        onLongClickLabel = onLongClickLabel,
        onLongClick = onLongClick,
        trailing = trailing,
        chevronSpace = !lesson.available,
    )
}

/** While another group's lessons load, their place keeps part of the screen, so the filter over it stays put. */
private const val LOADING_SHARE = 0.5f
