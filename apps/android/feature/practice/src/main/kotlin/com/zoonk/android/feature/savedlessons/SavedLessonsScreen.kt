package com.zoonk.android.feature.savedlessons

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
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
import com.zoonk.android.data.saveSections
import com.zoonk.android.data.value
import com.zoonk.android.feature.saves.UnavailableSaveRow
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.PageTitleRow
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.listRowDescription
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.DETAIL_PAGE_WIDTH
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.pagePadding
import com.zoonk.api.models.SavedLesson
import kotlinx.coroutines.launch
import java.util.UUID

@Composable
fun SavedLessonsScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val read = summary.value
    val goalId = read?.activeGoalId
    val scope = rememberCoroutineScope()
    val title = stringResource(R.string.navigation_saved_lessons)

    PageScaffold(
        onBack = { navigator.back() },
        title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                goalId != null -> {
                    SavedLessons(goalId, app.savedLessons, app.snackbars) { navigator.open(AppRoute.Lesson(it.toString())) }
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
 * Main's Saved lessons: one flat list, newest save first, each lesson's chapter under its title and its bookmark at
 * its end, the first [SHOWN_FIRST] until Show more; then the saves that can no longer open, each with Remove. A
 * lesson removed here keeps its row, its bookmark outlined, until the learner leaves, so a tap saves it again.
 */
@Composable
internal fun SavedLessons(
    goalId: UUID,
    store: SavedLessonsStore,
    snackbars: AppSnackbars,
    onOpen: (UUID) -> Unit,
) {
    val saves = rememberLessonSaves(store, goalId, snackbars)
    val resource = store.list[goalId]
    val state by resource.collectShown()
    val states by saves.states.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var showAll by rememberSaveable(goalId) { mutableStateOf(false) }
    val served = state.value?.lessons

    if (served == null) {
        if (state is LoadState.Failed) LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } }) else PageLoading()
        return
    }

    val (opens, gone) = saves.shown(served, states).saveSections({ it.available }) { states.isSaved(it.lessonId, true) }
    val shown = if (showAll) opens else opens.take(SHOWN_FIRST)

    BeforeFold { beforeFold ->
        LazyColumn(beforeFold.widthIn(max = DETAIL_PAGE_WIDTH).fillMaxSize(), contentPadding = pagePadding()) {
            item(key = "title", contentType = "title") {
                PageTitleRow(stringResource(R.string.navigation_saved_lessons), Modifier.padding(bottom = 16.dp))
            }

            if (opens.isEmpty() && gone.isEmpty()) {
                item(key = "empty", contentType = "empty") {
                    Text(
                        stringResource(R.string.savedlessons_empty),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }

            itemsIndexed(shown, key = { _, lesson -> lesson.lessonId }, contentType = { _, _ -> "lesson" }) { index, lesson ->
                val saved = states.isSaved(lesson.lessonId, true)
                Divided(index > 0) { SavedLessonRow(lesson, saved, onToggle = { saves.set(lesson.lessonId, !saved) }, onOpen) }
            }

            if (shown.size < opens.size) {
                item(key = "more", contentType = "more") {
                    Divided(true) {
                        ListRow(
                            headline = { Text(stringResource(R.string.savedlessons_show_more)) },
                            onClick = { showAll = true },
                            chevron = false,
                        )
                    }
                }
            }

            if (gone.isNotEmpty()) {
                item(key = "gone", contentType = "section") {
                    SectionHeader(stringResource(R.string.savedlessons_no_longer_available), Modifier.padding(top = 24.dp, bottom = 8.dp))
                }
                itemsIndexed(gone, key = { _, lesson -> "gone-${lesson.lessonId}" }, contentType = { _, _ -> "gone" }) { index, lesson ->
                    Divided(index > 0) {
                        UnavailableSaveRow(
                            title = lesson.title,
                            detail = lesson.chapterTitle,
                            remove = stringResource(R.string.savedlessons_remove),
                            spoken = stringResource(R.string.savedlessons_remove_spoken, lesson.title),
                            onRemove = { saves.set(lesson.lessonId, false) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SavedLessonRow(
    lesson: SavedLesson,
    saved: Boolean,
    onToggle: () -> Unit,
    onOpen: (UUID) -> Unit,
) {
    LessonSaveRow(saved, onToggle) { longPressLabel, onLongPress ->
        ListRow(
            headline = { Text(lesson.title) },
            supporting = listRowDescription(lesson.chapterTitle),
            onClick = { onOpen(lesson.lessonId) },
            onLongClickLabel = longPressLabel,
            onLongClick = onLongPress,
            trailing = { LessonRowBookmark(lesson.title, saved, onToggle) },
        )
    }
}

/** A list's rows reach its edges, a line between each. */
@Composable
private fun Divided(
    divided: Boolean,
    content: @Composable () -> Unit,
) {
    Column(Modifier.bleed(LIST_ITEM_INSET), verticalArrangement = Arrangement.Top) {
        if (divided) ListDivider()
        content()
    }
}

/** Main's page shows this many saves before Show more. */
private const val SHOWN_FIRST = 50
