package com.zoonk.android.feature.completedlessons

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.EmptyState
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.LoadMoreFooter
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.DETAIL_PAGE_WIDTH
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.detailPagePadding
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.api.models.CompletedLesson
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
    val titleAway by remember { derivedStateOf { listState.firstVisibleItemIndex > 0 } }
    val title = stringResource(R.string.navigation_completed_lessons)

    PageScaffold(
        onBack = { navigator.back() },
        title = { if (titleAway) Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                goalId != null -> {
                    // `finishedOn` is the goal's local day, and the summary is read again at its midnight.
                    val today = LocalDate.now(read.timeZone?.let(ZoneId::of) ?: ZoneId.systemDefault())
                    CompletedLessons(goalId, today, app.completedLessons, listState) { navigator.open(AppRoute.Lesson(it.toString())) }
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

/** Newest first, under the learner-local day each lesson was last finished. */
@Composable
internal fun CompletedLessons(
    goalId: UUID,
    today: LocalDate,
    store: CompletedLessonsStore,
    listState: LazyListState,
    onOpen: (UUID) -> Unit,
) {
    val resource = store.lessons[goalId]
    val state by resource.collectShown()
    val scope = rememberCoroutineScope()
    val list = state.value
    val nextCursor = list?.pagination?.nextCursor
    var loadingMore by remember(goalId) { mutableStateOf(false) }
    var moreFailed by rememberSaveable(goalId) { mutableStateOf(false) }
    val more = {
        if (!loadingMore) {
            loadingMore = true
            moreFailed = false
            scope.launch {
                moreFailed = !store.more(goalId)
                loadingMore = false
            }
        }
    }

    LaunchedEffect(listState, goalId, nextCursor) {
        snapshotFlow {
            listState.layoutInfo.visibleItemsInfo
                .lastOrNull()
                ?.index ?: 0
        }.distinctUntilChanged()
            .filter { last -> nextCursor != null && last >= listState.layoutInfo.totalItemsCount - LOAD_AHEAD }
            .collect { if (!moreFailed) more() }
    }

    if (list == null) {
        if (state is LoadState.Failed) LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } }) else PageLoading()
        return
    }

    val days = list.`data`.groupBy { it.finishedOn.toJavaLocalDate() }

    BeforeFold { beforeFold ->
        LazyColumn(beforeFold.widthIn(max = DETAIL_PAGE_WIDTH).fillMaxSize(), listState, detailPagePadding()) {
            item(key = "title", contentType = "title") {
                Text(
                    stringResource(R.string.navigation_completed_lessons),
                    Modifier.pageTitle(),
                    style = MaterialTheme.typography.titleLarge,
                )
            }

            if (days.isEmpty()) {
                item(key = "empty", contentType = "empty") {
                    EmptyState(
                        icon = R.drawable.ic_history,
                        title = stringResource(R.string.completed_lessons_empty_title),
                        description = stringResource(R.string.completed_lessons_empty_description),
                        modifier = Modifier.padding(top = 24.dp),
                    )
                }
            }

            days.forEach { (day, lessons) ->
                item(key = "day-$day", contentType = "day") {
                    SectionHeader(dayTitle(day, today), Modifier.padding(top = 24.dp, bottom = 8.dp))
                }
                itemsIndexed(lessons, key = { _, lesson -> lesson.lessonId }, contentType = { _, _ -> "lesson" }) { index, lesson ->
                    LessonRow(lesson, first = index == 0, onOpen)
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
    }
}

@Composable
private fun LessonRow(
    lesson: CompletedLesson,
    first: Boolean,
    onOpen: (UUID) -> Unit,
) {
    Column(Modifier.bleed(LIST_ITEM_INSET)) {
        if (!first) HorizontalDivider()
        ListRow(
            headline = { Text(lesson.title) },
            supporting = lesson.chapterTitle?.let { { Text(it) } },
            onClick = { onOpen(lesson.lessonId) },
        )
    }
}

/** "Today", "Yesterday", or the weekday and date, with the year only when it isn't this year's. */
@Composable
private fun dayTitle(
    day: LocalDate,
    today: LocalDate,
): String =
    when (day) {
        today -> stringResource(R.string.completed_lessons_today)
        today.minusDays(1) -> stringResource(R.string.completed_lessons_yesterday)
        else -> formatDate(day, currentLocale(), if (day.year == today.year) DateStyle.WeekdayDay else DateStyle.WeekdayDayYear, today)
    }

private const val LOAD_AHEAD = 4
