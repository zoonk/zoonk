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
import androidx.compose.runtime.saveable.rememberSaveable
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
import com.zoonk.android.data.isSaved
import com.zoonk.android.data.saveSections
import com.zoonk.android.feature.plan.MoreChaptersRow
import com.zoonk.android.feature.saves.SaveMenu
import com.zoonk.android.feature.saves.SaveSwipe
import com.zoonk.android.feature.saves.UnavailableSaveRow
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.HeldSlot
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.OpeningDay
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.rememberOpeningDay
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
import java.util.UUID
import kotlin.time.toJavaInstant

private val NOT_MADE =
    setOf(GoalMindMap.Status.AVAILABLE, GoalMindMap.Status.WRITING_LESSONS, GoalMindMap.Status.DRAWING, GoalMindMap.Status.FAILED)

/** The Chapters tab's index: the ready maps, by subject. */
internal fun GoalMindMaps.chapterIndex(): List<IndexGroup<GoalMindMap>> =
    chapters
        .filter { it.status == GoalMindMap.Status.READY }
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

/** Chapters: the ready maps by subject, then the chapters without a map. */
internal fun LazyListScope.chaptersTab(
    mindMaps: GoalMindMaps,
    shown: IndexState,
    notMadeOpen: Boolean,
    actions: TabActions,
    listsNotMade: Boolean = true,
) {
    val groups = mindMaps.chapterIndex()
    val notMade = mindMaps.notMade

    if (groups.isEmpty() && (!listsNotMade || notMade.none { it.canMakeNow() })) {
        item(key = "chapters-empty", contentType = "empty") {
            // A finished chapter's map is claimed like any other, so it waits while the offer is stopped.
            val stopped = mindMaps.createOffer.let { it.stop != null && it.startable == 0L }
            TabEmpty(if (stopped) R.string.mindmaps_empty_stopped else R.string.mindmaps_empty)
        }
    }

    index(StudyTab.Chapters, boundedIndex(groups, shown.opened, shown.showAll), actions, { it.chapterId.toString() }) { map, divided ->
        Divided(divided) { ChapterRow(map, actions, stop = mindMaps.createOffer.stop) }
    }

    if (listsNotMade && notMade.isNotEmpty()) notMadeBlock(mindMaps, shown, notMadeOpen, actions)
}

/** [stop] is what keeps any new map from starting now ([gate]), which takes its Create away; [numbered] rows say which chapter they are. */
@Composable
private fun ChapterRow(
    map: GoalMindMap,
    actions: TabActions,
    open: (() -> Unit)? = null,
    stop: MindMapAllowanceStop? = null,
    numbered: Boolean = true,
    compact: Boolean = false,
) {
    val target = MindMapTarget(SavedMindMapKind.CHAPTER, map.chapterId)
    val local = rowLocal(actions.state.requests[map.chapterId], MindMapPlace.Library)
    val shown = shownMindMap(map.status.shown, local)
    val ready = shown == MindMapShown.Ready
    val saved = ready && actions.saved(target, map.saved)
    val toggle = { actions.page.save(target, !saved) }

    SaveSwipe(saved, mapSaveWords(), onToggle = toggle.takeIf { ready }) {
        MindMapRow(
            map = map.facts,
            place = MindMapPlace.Library,
            shown = shown,
            local = local,
            cap = stop?.gate(actions.state.tier),
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
            compact = compact,
        )
    }
}

/** The chapters whose map isn't made yet. */
internal val GoalMindMaps.notMade: List<GoalMindMap> get() = chapters.filter { it.status in NOT_MADE }

/** Main's `needsAttention`: a map on its way, or one that didn't finish with its Try again, so its row leads the list. */
private fun GoalMindMap.needsAttention(): Boolean = status in ON_ITS_WAY_OR_FAILED

private val ON_ITS_WAY_OR_FAILED = setOf(GoalMindMap.Status.WRITING_LESSONS, GoalMindMap.Status.DRAWING, GoalMindMap.Status.FAILED)

/** The chapters No map yet shows first, and the rest, folded by subject (one group without a name when there are none). */
internal data class NotMadeOrder(
    val next: List<GoalMindMap>,
    val rest: List<IndexGroup<GoalMindMap>>,
)

private const val NEXT_ROWS = 5

/** A few more than the first rows aren't worth folding away. */
private const val FOLD_AFTER = NEXT_ROWS + 2

/**
 * Main's `orderNotMade`: maps on their way or failed, then chapters whose lessons are all written (made in half a
 * minute), then chapters the learner finished a lesson in, then the rest, the syllabus's order within each.
 */
internal fun notMadeOrder(
    notMade: List<GoalMindMap>,
    studied: Set<UUID>,
): NotMadeOrder {
    fun rank(map: GoalMindMap) =
        when {
            map.needsAttention() -> 0
            map.canMakeNow() -> 1
            map.chapterId in studied -> 2
            else -> 3
        }

    val ordered = notMade.sortedBy { rank(it) }
    if (ordered.size <= FOLD_AFTER) return NotMadeOrder(ordered, emptyList())

    val next = ordered.take(NEXT_ROWS)
    val rest = notMade - next.toSet()
    val groups =
        if (rest.all { it.subject != null }) {
            rest.groupBy { it.subject?.key.orEmpty() }.map { (key, maps) -> IndexGroup(key, maps.first().subject?.name, maps) }
        } else {
            listOf(IndexGroup("", null, rest))
        }
    return NotMadeOrder(next, groups)
}

/**
 * What each tab counts, as main's `countTabs`: the ready chapter maps, every lesson map, and every saved map it lists,
 * leaving out one removed on this visit whose row is kept.
 */
internal fun GoalMindMaps.tabCounts(saves: Map<MindMapTarget, Boolean>): Map<StudyTab, Int> =
    mapOf(
        StudyTab.Chapters to chapters.count { it.status == GoalMindMap.Status.READY },
        StudyTab.Lessons to lessonGroups.sumOf { it.count.toInt() },
        StudyTab.Saved to listedSaves(saves).saved.size,
    )

/** The maps as read, their saved ones only those still saved after this visit's taps: what the Saved tab counts and studies. */
internal fun GoalMindMaps.listedSaves(saves: Map<MindMapTarget, Boolean>): GoalMindMaps =
    copy(saved = saved.filter { saves.isSaved(it.target, true) })

/** A chapter whose lessons are all written: its map is made, or being made, without writing any. */
private fun GoalMindMap.canMakeNow(): Boolean =
    lessonsToWrite == 0L &&
        (status == GoalMindMap.Status.AVAILABLE || status == GoalMindMap.Status.DRAWING || status == GoalMindMap.Status.FAILED)

/**
 * Main's `NotMadeYet` under its own No map yet heading that counts them all: the five chapters the learner most likely
 * wants, the rest folded by subject (or behind one row that counts them when the goal has none), then Create all when
 * two or more can start and one line about them all, after the rows they act on. Its rows show the chapter's name and
 * its action alone.
 */
internal fun LazyListScope.notMadeBlock(
    mindMaps: GoalMindMaps,
    shown: IndexState,
    open: Boolean,
    actions: TabActions,
    beside: Boolean = false,
) {
    val notMade = mindMaps.notMade
    val order = notMadeOrder(notMade, mindMaps.lessonGroups.map { it.chapterId }.toSet())
    val stop = mindMaps.createOffer.stop
    // On Plus, a row says its lessons take a few minutes once it starts; the free plans' cost is said once, here.
    val note =
        stop == null && !actions.state.plus && notMade.any { it.lessonsToWrite > 0 && it.status != GoalMindMap.Status.WRITING_LESSONS }

    item(key = "not-made-title", contentType = "title") {
        SectionHeader(
            stringResource(R.string.mindmaps_other_chapters),
            Modifier.padding(top = if (beside) 0.dp else 24.dp, bottom = 8.dp),
            detail = formatNumber(notMade.size.toDouble(), currentLocale()),
        )
    }
    if (note) {
        item(key = "not-made-spends", contentType = "line") {
            Text(
                stringResource(R.string.mindmaps_lessons_count_free),
                Modifier.padding(bottom = 8.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
    items(order.next, key = { "next-${it.chapterId}" }, contentType = { "map" }) { map ->
        Divided(map != order.next.first()) { ChapterRow(map, actions, stop = stop, numbered = false, compact = true) }
    }
    order.rest.forEach { group ->
        val key = "not-made:${group.key}"
        val name = group.name
        val unfolded = if (name == null) open else key in shown.opened
        item(key = "fold-$key", contentType = "fold") {
            if (name == null) {
                MoreChaptersRow(
                    text =
                        if (open) {
                            stringResource(R.string.plan_show_fewer_chapters)
                        } else {
                            pluralStringResource(R.plurals.plan_more_chapters, group.rows.size, group.rows.size)
                        },
                    open = open,
                    onClick = actions.toggleNotMade,
                )
            } else {
                SubjectTitle(IndexEntry.Subject(key, name, group.rows.size, unfolded), actions.toggleSubject)
            }
        }
        if (unfolded) {
            items(group.rows, key = { "rest-${it.chapterId}" }, contentType = { "map" }) { map ->
                Divided(true) { ChapterRow(map, actions, stop = stop, numbered = false, compact = true) }
            }
        }
    }
    item(key = "not-made", contentType = "not-made") {
        NotMadeSummary(mindMaps, notMade, actions)
    }
}

@Composable
private fun NotMadeSummary(
    mindMaps: GoalMindMaps,
    notMade: List<GoalMindMap>,
    actions: TabActions,
) {
    val offer = mindMaps.createOffer
    // What stops a new map also takes the rows' Create away, so it shows whether or not a chapter is ready to make.
    val limit =
        offer.stop
            ?.takeIf { offer.startable == 0L }
            ?.gate(actions.state.tier)
    HeldSlot(gated = limit != null, Modifier.padding(top = 16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (offer.startable > 1) {
                OutlinedButton(
                    onClick = actions.page.createAll,
                    busy = actions.state.createAll == CreateAll.Pending,
                    leadingIcon = { ButtonIcon(R.drawable.ic_add) },
                ) { Text(stringResource(R.string.mindmaps_create_all)) }
            }

            Box(Modifier.semantics { liveRegion = LiveRegionMode.Polite }) { NotMadeLine(mindMaps, notMade, limit, actions) }
        }
    }
}

/**
 * The block's one line about [notMade], the first that applies (main's order): the tap didn't reach the
 * server, what stops every map from starting, maps on their way, or how many more fit now. What stops the
 * learner outranks what's in progress; each map on its way, and each that didn't finish, says so on its own row.
 */
@Composable
private fun NotMadeLine(
    mindMaps: GoalMindMaps,
    notMade: List<GoalMindMap>,
    limit: Limit?,
    actions: TabActions,
) {
    val offer = mindMaps.createOffer
    val locale = currentLocale()
    val onTheWay = notMade.count { it.status == GoalMindMap.Status.DRAWING || it.status == GoalMindMap.Status.WRITING_LESSONS }
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

            else -> {
                return
            }
        }
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

/**
 * The offer's stop gates the page until a read of the list lifts it, whatever this device's clock says: a day
 * already past here isn't printed (main's rule for a list with its own offer).
 */
@Composable
private fun MindMapAllowanceStop.gate(tier: LimitTier): Limit {
    val limit = limit(tier)
    val passed = rememberOpeningDay((limit as? Limit.Reached)?.availableAt) == OpeningDay.Open
    return if (passed && limit is Limit.Reached) limit.copy(availableAt = null) else limit
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
                    MindMapAllowanceStop.Period.ROLLING30_DAYS -> LimitPeriod.Rolling30Days
                    MindMapAllowanceStop.Period.TOTAL -> LimitPeriod.Total
                    MindMapAllowanceStop.Period.DAY, null -> LimitPeriod.Day
                },
                availableAt = availableAt?.toJavaInstant(),
            )
        }
    }

private val MindMapAllowanceStop?.limitSubject: LimitSubject
    get() =
        when (this?.resource) {
            MindMapAllowanceStop.Resource.AI_SPEND -> LimitSubject.Help
            else -> LimitSubject.MindMaps
        }

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
            TabEmpty(R.string.mindmaps_lessons_empty)
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
    val count = group.count.toInt()

    ListRow(
        headline = { Text(chapter.title) },
        onClick = { actions.page.study(StudyTab.Lessons, MapPlace(group.chapterId.toString())) },
        leading = { MapMark(null, MindMapShown.Available) },
        supporting = {
            Text(
                factsLine(
                    stringResource(R.string.mindmaps_chapter_number, formatNumber(chapter.position.toDouble(), locale)),
                    pluralStringResource(R.plurals.mindmaps_lesson_maps, count, formatNumber(count.toDouble(), locale)),
                ),
            )
        },
    )
}

/**
 * Saved: the maps that open, in syllabus order, then the ones that can't anymore, each with Remove. A map removed on
 * this visit keeps its row, its bookmark outlined, until the learner leaves, so a tap saves it again; one that can't
 * open leaves at once.
 */
internal fun LazyListScope.savedTab(
    mindMaps: GoalMindMaps,
    shown: IndexState,
    actions: TabActions,
) {
    val (opens, gone) =
        (actions.state.savedShown ?: mindMaps.saved).saveSections({ it.available }) { actions.saved(it.target, true) }
    if (opens.isEmpty() && gone.isEmpty()) {
        item(key = "saved-empty", contentType = "empty") {
            TabEmpty(R.string.mindmaps_saved_empty)
        }
        return
    }

    val chapters = mindMaps.chapters.associateBy { it.chapterId }

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
            Divided(entry != gone.first()) {
                UnavailableSaveRow(
                    title = entry.title,
                    detail = entry.kindLabel(),
                    remove = stringResource(R.string.mindmaps_remove),
                    spoken = stringResource(R.string.mindmaps_remove_spoken, entry.title),
                    onRemove = { actions.page.save(entry.target, false) },
                    leading = { MapMark(null, MindMapShown.Unavailable) },
                )
            }
        }
    }
}

internal val SavedMindMap.target: MindMapTarget get() = MindMapTarget(kind, targetId)

private val SavedMindMap.key: String get() = "${kind.value}-$targetId"

/** A saved map's kind, under its title. Saved has no subject headers, so a chapter's number would read alike across subjects. */
@Composable
private fun SavedMindMap.kindLabel(): String =
    stringResource(if (kind == SavedMindMapKind.LESSON) R.string.mindmaps_lesson_map else R.string.mindmaps_chapter_map)

/** A saved map's row, opening it in the Saved deck, its bookmark at its end: filled, which removes it, then outlined. */
@Composable
private fun SavedRow(
    entry: SavedMindMap,
    chapter: GoalMindMap?,
    actions: TabActions,
) {
    val lesson = entry.kind == SavedMindMapKind.LESSON
    val saved = actions.saved(entry.target, true)
    val toggle = { actions.page.save(entry.target, !saved) }
    val words = mapSaveWords()
    var menu by remember { mutableStateOf(false) }
    val place = MapPlace(entry.chapterId.toString(), entry.targetId.toString().takeIf { lesson })

    SaveSwipe(saved, words, onToggle = toggle) {
        Box {
            ListRow(
                headline = { Text(entry.title) },
                onClick = { actions.page.study(entry.deckTab(saved), place) },
                onLongClickLabel = if (saved) words.unsave else words.save,
                onLongClick = { menu = true },
                leading = { MapMark(chapter?.image?.thumbnailUrl?.takeUnless { lesson }, MindMapShown.Ready) },
                supporting = { Text(entry.kindLabel()) },
                trailing = { MapRowBookmark(entry.title, saved, toggle) },
            )
            SaveMenu(menu, saved, words, onDismiss = { menu = false }, onToggle = toggle)
        }
    }
}
