package com.zoonk.android.feature.mindmaps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.GoalMindMap
import com.zoonk.api.models.GoalMindMaps
import com.zoonk.api.models.LessonMapGroup
import com.zoonk.api.models.MindMapAllowanceStop
import com.zoonk.api.models.SavedMindMap
import com.zoonk.api.models.SavedMindMapKind
import kotlinx.coroutines.launch

private val NOT_MADE =
    setOf(GoalMindMap.Status.AVAILABLE, GoalMindMap.Status.WRITING_LESSONS, GoalMindMap.Status.DRAWING, GoalMindMap.Status.FAILED)

/** The Chapters tab's index: the ready maps and the Plus-locked ones, by subject. */
internal fun GoalMindMaps.chapterIndex(): List<IndexGroup<GoalMindMap>> =
    chapters
        .filter { it.status == GoalMindMap.Status.READY || it.status == GoalMindMap.Status.PLUS_REQUIRED }
        .groupBy { it.subject?.key.orEmpty() }
        .map { (key, maps) -> IndexGroup(key, maps.first().subject?.name, maps) }

/** The Lessons tab's index: each chapter with lesson maps, by subject. */
internal fun GoalMindMaps.lessonIndex(): List<IndexGroup<Pair<LessonMapGroup, GoalMindMap>>> {
    val byId = chapters.associateBy { it.chapterId }

    return lessonGroups
        .mapNotNull { group -> byId[group.chapterId]?.let { group to it } }
        .groupBy { (_, chapter) -> chapter.subject?.key.orEmpty() }
        .map { (key, rows) ->
            IndexGroup(
                key,
                rows
                    .first()
                    .second.subject
                    ?.name,
                rows,
            )
        }
}

/** Chapters: the ready maps and the Plus-locked ones by subject, then the maps not made yet. */
internal fun LazyListScope.chaptersTab(
    mindMaps: GoalMindMaps,
    shown: IndexState,
    notMadeOpen: Boolean,
    actions: TabActions,
) {
    val groups = mindMaps.chapterIndex()
    val notMade = mindMaps.chapters.filter { it.status in NOT_MADE }

    if (groups.isEmpty() && notMade.isEmpty()) {
        item(key = "chapters-empty", contentType = "empty") {
            TabEmpty(R.drawable.ic_lan, R.string.mindmaps_empty_title, R.string.mindmaps_empty_description) {
                KeepStudying(actions.page.keepStudying)
            }
        }
        return
    }

    index(StudyTab.Chapters, boundedIndex(groups, shown.opened, shown.showAll), actions, { it.chapterId.toString() }) { map, divided ->
        Divided(divided) { ChapterRow(map, actions) }
    }

    if (notMade.isNotEmpty()) notMadeBlock(mindMaps, notMade, notMadeOpen, actions)
}

/** [stop] is what keeps any new map from starting now, which takes its Create away; [numbered] rows say which chapter they are. */
@Composable
private fun ChapterRow(
    map: GoalMindMap,
    actions: TabActions,
    open: (() -> Unit)? = null,
    stop: Limit? = null,
    numbered: Boolean = true,
) {
    val target = MindMapTarget(SavedMindMapKind.CHAPTER, map.chapterId)
    val local = actions.state.requests[map.chapterId]
    val shown = shownMindMap(map.status.shown, local)
    val ready = shown == MindMapShown.Ready
    val saved = ready && actions.saved(target, map.saved)
    val toggle = { actions.page.save(target, map.chapterId, !saved) }

    SaveSwipe(saved, onToggle = toggle.takeIf { ready }) {
        MindMapRow(
            map = map.facts,
            place = MindMapPlace.Library,
            shown = shown,
            local = local,
            cap = stop,
            plus = actions.state.plus,
            actions =
                MindMapRowActions(
                    create = { actions.page.create(map.chapterId) },
                    navigate = actions.page.navigate,
                    open = open ?: { actions.page.study(StudyTab.Chapters, MapPlace(map.chapterId.toString())) },
                    toggleSave = toggle,
                ),
            saved = saved,
            numbered = numbered,
        )
    }
}

/**
 * Main's "Not made yet": a button that starts as many maps as can start now, one line (the first
 * that applies), and those chapters folded under Show chapters, each with its Create while a new
 * map can start. The list mixes subjects without their headers, so its rows go without their number.
 */
private fun LazyListScope.notMadeBlock(
    mindMaps: GoalMindMaps,
    notMade: List<GoalMindMap>,
    open: Boolean,
    actions: TabActions,
) {
    item(key = "not-made", contentType = "not-made") {
        NotMadeSummary(mindMaps, actions)
    }
    item(key = "not-made-toggle", contentType = "toggle") {
        ListRow(
            headline = { Text(stringResource(R.string.mindmaps_show_chapters)) },
            modifier = Modifier.bleed(LIST_ITEM_INSET).padding(top = 4.dp),
            onClick = actions.toggleNotMade,
            expanded = open,
            meta = { Text(formatNumber(notMade.size.toDouble(), currentLocale())) },
        )
    }
    if (open) {
        val offer = mindMaps.createOffer
        val stop = offer.stop?.takeIf { offer.startable == 0L }?.limit(actions.state.tier)
        // On Plus, a row says its lessons take a few minutes once it starts; the free plans' cost is said once, here.
        if (stop == null && actions.state.tier != LimitTier.Plus && notMade.any { it.lessonsToWrite > 0 }) {
            item(key = "not-made-note", contentType = "note") {
                Text(
                    stringResource(R.string.mindmaps_lessons_count_free),
                    Modifier.padding(vertical = 8.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        items(notMade, key = { "not-made-${it.chapterId}" }, contentType = { "map" }) { map ->
            Divided(true) { ChapterRow(map, actions, stop = stop, numbered = false) }
        }
    }
}

@Composable
private fun NotMadeSummary(
    mindMaps: GoalMindMaps,
    actions: TabActions,
) {
    val offer = mindMaps.createOffer

    Column(Modifier.padding(top = 24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.mindmaps_not_made_yet))

        if (offer.startable > 0) {
            val count = offer.startable.toInt()
            OutlinedButton(
                onClick = actions.page.createAll,
                busy = actions.state.createAll == CreateAll.Pending,
            ) { Text(pluralStringResource(R.plurals.mindmaps_create_count, count, formatNumber(count.toDouble(), currentLocale()))) }
        }

        Box(Modifier.semantics { liveRegion = LiveRegionMode.Polite }) { NotMadeLine(mindMaps, actions) }
    }
}

/**
 * The block's one line, the first that applies: the tap didn't reach the server, what stops every
 * map from starting, maps on their way, how many more fit now, or chapters whose lessons come first.
 */
@Composable
private fun NotMadeLine(
    mindMaps: GoalMindMaps,
    actions: TabActions,
) {
    val offer = mindMaps.createOffer
    val locale = currentLocale()
    val onTheWay = mindMaps.chapters.count { it.status == GoalMindMap.Status.DRAWING || it.status == GoalMindMap.Status.WRITING_LESSONS }
    // What stops a new map also takes the rows' Create away, so it shows whether or not a chapter is ready to make.
    val limit = (offer.stop?.limit(actions.state.tier) ?: actions.state.cap.takeIf { offer.eligible > 0 }).takeIf { offer.startable == 0L }
    val counted = @Composable { id: Int, count: Long -> pluralStringResource(id, count.toInt(), formatNumber(count.toDouble(), locale)) }

    val text =
        when {
            actions.state.createAll == CreateAll.Unreachable -> {
                stringResource(R.string.mindmaps_unreachable)
            }

            limit != null -> {
                MindMapLimit(limit, offer.stop.limitSubject, actions.page.navigate)
                return
            }

            onTheWay > 0 -> {
                counted(R.plurals.mindmaps_being_made, onTheWay.toLong())
            }

            offer.startable in 1..<offer.eligible -> {
                counted(R.plurals.mindmaps_can_make_more, offer.startable)
            }

            offer.needLessons > 0 -> {
                counted(R.plurals.mindmaps_need_lessons, offer.needLessons)
            }

            else -> {
                return
            }
        }
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

/** The server's reason nothing more can start, as the app's limits word it; [tier] is the learner's plan. */
internal fun MindMapAllowanceStop.limit(tier: LimitTier): Limit =
    when (reason) {
        MindMapAllowanceStop.Reason.SLOW_DOWN -> {
            Limit.SlowDown(SLOW_DOWN_SECONDS)
        }

        MindMapAllowanceStop.Reason.SIGN_UP_REQUIRED -> {
            Limit.SignUpRequired
        }

        MindMapAllowanceStop.Reason.LIMIT_REACHED -> {
            Limit.Reached(
                tier,
                when (period) {
                    MindMapAllowanceStop.Period.MONTH -> LimitPeriod.Month
                    MindMapAllowanceStop.Period.TOTAL -> LimitPeriod.Total
                    MindMapAllowanceStop.Period.DAY, null -> LimitPeriod.Day
                },
            )
        }
    }

private val MindMapAllowanceStop?.limitSubject: LimitSubject
    get() = if (this?.resource == MindMapAllowanceStop.Resource.AI_SPEND) LimitSubject.Help else LimitSubject.MindMaps

/** The notice only says to wait; the time isn't shown. */
private const val SLOW_DOWN_SECONDS = 60

/** Lessons: one row per chapter with lesson maps, opening the Lessons deck at that chapter's first. */
internal fun LazyListScope.lessonsTab(
    mindMaps: GoalMindMaps,
    shown: IndexState,
    actions: TabActions,
) {
    if (mindMaps.lessonGroups.isEmpty()) {
        item(key = "lessons-empty", contentType = "empty") {
            TabEmpty(R.drawable.ic_lan, R.string.mindmaps_lessons_empty_title, R.string.mindmaps_lessons_empty_description)
        }
        return
    }

    index(StudyTab.Lessons, boundedIndex(mindMaps.lessonIndex(), shown.opened, shown.showAll), actions, {
        it.first.chapterId.toString()
    }) { (group, chapter), divided ->
        Divided(divided) { LessonGroupRow(group, chapter, actions) }
    }
}

@Composable
private fun LessonGroupRow(
    group: LessonMapGroup,
    chapter: GoalMindMap,
    actions: TabActions,
) {
    val locale = currentLocale()
    val allLocked = group.locked >= group.count
    val count = group.count.toInt()
    val locked = group.locked.toInt()

    ListRow(
        headline = { Text(chapter.title) },
        onClick = {
            if (allLocked) {
                actions.page.navigate(AppRoute.Subscription)
            } else {
                actions.page.study(StudyTab.Lessons, MapPlace(group.chapterId.toString()))
            }
        },
        leading = { MapMark(null, if (allLocked) MindMapShown.PlusRequired else MindMapShown.Available) },
        supporting = {
            Text(
                factsLine(
                    stringResource(R.string.mindmaps_chapter_number, formatNumber(chapter.position.toDouble(), locale)),
                    pluralStringResource(R.plurals.mindmaps_lesson_maps, count, formatNumber(count.toDouble(), locale)),
                    if (locked >
                        0
                    ) {
                        pluralStringResource(R.plurals.mindmaps_locked_count, locked, formatNumber(locked.toDouble(), locale))
                    } else {
                        null
                    },
                ),
            )
        },
    )
}

/** Saved: the maps that open, in syllabus order, then the ones that can't anymore, each with Remove. */
internal fun LazyListScope.savedTab(
    mindMaps: GoalMindMaps,
    shown: IndexState,
    actions: TabActions,
) {
    val kept = mindMaps.saved.filter { actions.saved(it.target, true) }
    if (kept.isEmpty()) {
        item(key = "saved-empty", contentType = "empty") {
            TabEmpty(R.drawable.ic_bookmark, R.string.mindmaps_saved_empty_title, R.string.mindmaps_saved_empty_description)
        }
        return
    }

    val chapters = mindMaps.chapters.associateBy { it.chapterId }
    val opens = kept.filter { it.available }
    val gone = kept.filterNot { it.available }

    index(
        StudyTab.Saved,
        boundedIndex(listOf(IndexGroup("", null, opens)), emptySet(), shown.showAll),
        actions,
        { it.key },
    ) { entry, divided ->
        Divided(divided) { SavedRow(entry, entry.chapterId?.let(chapters::get), actions) }
    }

    if (gone.isNotEmpty()) {
        item(key = "saved-gone", contentType = "section") {
            SectionHeader(stringResource(R.string.mindmaps_no_longer_available), Modifier.padding(top = 24.dp, bottom = 8.dp))
        }
        items(gone, key = { "gone-${it.key}" }, contentType = { "gone" }) { entry ->
            Divided(entry != gone.first()) { GoneRow(entry, actions) }
        }
    }
}

internal val SavedMindMap.target: MindMapTarget get() = MindMapTarget(kind, targetId)

private val SavedMindMap.key: String get() = "${kind.value}-$targetId"

@Composable
private fun SavedRow(
    entry: SavedMindMap,
    chapter: GoalMindMap?,
    actions: TabActions,
) {
    val locale = currentLocale()
    val number = chapter?.let { stringResource(R.string.mindmaps_chapter_number, formatNumber(it.position.toDouble(), locale)) }
    val lesson = entry.kind == SavedMindMapKind.LESSON
    val remove = { actions.page.save(entry.target, entry.chapterId, false) }
    var menu by remember { mutableStateOf(false) }
    val place = MapPlace(entry.chapterId.toString(), entry.targetId.toString().takeIf { lesson })

    SaveSwipe(saved = true, onToggle = remove) {
        Box {
            ListRow(
                headline = { Text(entry.title) },
                onClick = { actions.page.study(StudyTab.Saved, place) },
                onLongClickLabel = stringResource(R.string.mindmaps_unsave),
                onLongClick = { menu = true },
                leading = { MapMark(chapter?.image?.thumbnailUrl?.takeUnless { lesson }, MindMapShown.Ready) },
                supporting = { Text(factsLine(number, if (lesson) stringResource(R.string.mindmaps_lesson_map) else null)) },
            )
            SaveMenu(menu, saved = true, onDismiss = { menu = false }, onToggle = remove)
        }
    }
}

@Composable
private fun GoneRow(
    entry: SavedMindMap,
    actions: TabActions,
) {
    val spoken = stringResource(R.string.mindmaps_remove_spoken, entry.title)
    ListRow(
        headline = { Text(entry.title) },
        leading = { MapMark(null, MindMapShown.Unavailable) },
        supporting = if (entry.kind == SavedMindMapKind.LESSON) ({ Text(stringResource(R.string.mindmaps_lesson_map)) }) else null,
        trailing = {
            TextButton(
                onClick = { actions.page.save(entry.target, entry.chapterId, false) },
                modifier = Modifier.semantics { contentDescription = spoken },
            ) { Text(stringResource(R.string.mindmaps_remove)) }
        },
    )
}

/**
 * Swiping a row either way saves its map, or removes it when saved, then the row slides back: the
 * same as its long-press menu. Nothing to swipe without [onToggle].
 */
@Composable
internal fun SaveSwipe(
    saved: Boolean,
    onToggle: (() -> Unit)?,
    content: @Composable () -> Unit,
) {
    if (onToggle == null) {
        content()
        return
    }
    val state = rememberSwipeToDismissBoxState()
    val scope = rememberCoroutineScope()

    SwipeToDismissBox(
        state = state,
        backgroundContent = {
            val start = state.dismissDirection == SwipeToDismissBoxValue.StartToEnd
            Row(
                Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceContainerHigh).padding(horizontal = LIST_ITEM_INSET),
                horizontalArrangement = if (start) Arrangement.Start else Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    painterResource(if (saved) R.drawable.ic_bookmark else R.drawable.ic_bookmark_filled),
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    stringResource(if (saved) R.string.mindmaps_unsave else R.string.mindmaps_save),
                    Modifier.padding(horizontal = 8.dp),
                    style = MaterialTheme.typography.labelLarge,
                )
            }
        },
        onDismiss = {
            onToggle()
            scope.launch { state.reset() }
        },
    ) {
        Column(Modifier.background(MaterialTheme.colorScheme.surface)) { content() }
    }
}
