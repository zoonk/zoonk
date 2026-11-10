package com.zoonk.android.feature.mindmaps

import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.api.models.AllowanceItem
import com.zoonk.api.models.AllowanceResponse
import com.zoonk.api.models.ChapterMindMap
import com.zoonk.api.models.ChapterMindMapStatus
import com.zoonk.api.models.GoalMindMap
import com.zoonk.api.models.MindMapGeneration
import java.text.Normalizer
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/** What a map's row says, from the server's status and what this screen asked for. */
enum class MindMapShown {
    Unavailable,
    Available,
    WritingLessons,
    Drawing,
    Ready,
    Failed,
    PlusRequired,
    Refused,
    Unreachable,
    ;

    val onItsWay: Boolean get() = this == WritingLessons || this == Drawing

    /** How often a row on its way asks again: writing lessons takes minutes, drawing half a minute. */
    val pollEvery: Duration get() = if (this == WritingLessons) 15.seconds else 4.seconds
}

/**
 * What a tap or a poll got that the map's reads can't say: a request on its way ([pending]), a
 * refusal ([limit], worded by [subject]) or a server out of reach ([unreachable]). A refusal or a
 * lost connection lasts until a read of the map started after it ([since]) comes through, even one
 * that reads the same, as after buying Plus.
 */
data class MindMapLocal(
    val pending: Boolean = false,
    val limit: Limit? = null,
    val subject: LimitSubject = LimitSubject.MindMaps,
    val unreachable: Boolean = false,
    val since: Long = 0,
)

/**
 * The reads decide, but for a refusal or a lost connection no newer read has replaced yet; a drawn
 * map or a Plus lock leaves nothing for either to be about.
 */
fun shownMindMap(
    server: MindMapShown,
    local: MindMapLocal?,
): MindMapShown =
    when {
        server == MindMapShown.Ready || server == MindMapShown.PlusRequired -> server
        local?.unreachable == true -> MindMapShown.Unreachable
        local?.limit != null -> MindMapShown.Refused
        else -> server
    }

val GoalMindMap.Status.shown: MindMapShown
    get() =
        when (this) {
            GoalMindMap.Status.AVAILABLE -> MindMapShown.Available
            GoalMindMap.Status.WRITING_LESSONS -> MindMapShown.WritingLessons
            GoalMindMap.Status.DRAWING -> MindMapShown.Drawing
            GoalMindMap.Status.READY -> MindMapShown.Ready
            GoalMindMap.Status.FAILED -> MindMapShown.Failed
            GoalMindMap.Status.PLUS_REQUIRED -> MindMapShown.PlusRequired
        }

val ChapterMindMap.Status.shown: MindMapShown
    get() =
        when (this) {
            ChapterMindMap.Status.UNAVAILABLE -> MindMapShown.Unavailable
            ChapterMindMap.Status.AVAILABLE -> MindMapShown.Available
            ChapterMindMap.Status.WRITING_LESSONS -> MindMapShown.WritingLessons
            ChapterMindMap.Status.DRAWING -> MindMapShown.Drawing
            ChapterMindMap.Status.READY -> MindMapShown.Ready
            ChapterMindMap.Status.FAILED -> MindMapShown.Failed
            ChapterMindMap.Status.PLUS_REQUIRED -> MindMapShown.PlusRequired
        }

val ChapterMindMapStatus.Status.shown: MindMapShown
    get() =
        when (this) {
            ChapterMindMapStatus.Status.UNAVAILABLE -> MindMapShown.Unavailable
            ChapterMindMapStatus.Status.AVAILABLE -> MindMapShown.Available
            ChapterMindMapStatus.Status.WRITING_LESSONS -> MindMapShown.WritingLessons
            ChapterMindMapStatus.Status.DRAWING -> MindMapShown.Drawing
            ChapterMindMapStatus.Status.READY -> MindMapShown.Ready
            ChapterMindMapStatus.Status.FAILED -> MindMapShown.Failed
            ChapterMindMapStatus.Status.PLUS_REQUIRED -> MindMapShown.PlusRequired
        }

val MindMapGeneration.Status.shown: MindMapShown
    get() =
        when (this) {
            MindMapGeneration.Status.READY -> MindMapShown.Ready
            MindMapGeneration.Status.WRITING_LESSONS -> MindMapShown.WritingLessons
            MindMapGeneration.Status.DRAWING -> MindMapShown.Drawing
        }

/** Main's `getReachedCap`: the learner's plan has no [kind] left now, and until when. */
fun AllowanceResponse.reachedCap(kind: AllowanceItem.Kind): Limit.Reached? {
    val item = items.firstOrNull { it.kind == kind } ?: return null
    val remaining = item.remaining
    if (remaining == null || remaining > 0) return null

    val period =
        when {
            usedUp(item.totalLimit, item.usedTotal) -> LimitPeriod.Total
            usedUp(item.monthlyLimit, item.usedThisMonth) -> LimitPeriod.Month
            else -> LimitPeriod.Day
        }
    val tier =
        when (tier) {
            AllowanceResponse.Tier.GUEST -> LimitTier.Guest
            AllowanceResponse.Tier.FREE -> LimitTier.Free
            AllowanceResponse.Tier.PLUS -> LimitTier.Plus
        }
    return Limit.Reached(tier, period)
}

private fun usedUp(
    limit: Long?,
    used: Long,
) = limit != null && used >= limit

/** Main's `toMindMapFileName`: "Ondas e som" saves as "ondas-e-som.webp". */
fun mindMapFileName(title: String): String {
    val words =
        WORD
            .findAll(Normalizer.normalize(title, Normalizer.Form.NFD).replace(MARK, "").lowercase())
            .map { it.value }
            .toList()
    return "${words.ifEmpty { listOf("mind-map") }.joinToString("-")}.webp"
}

private val MARK = Regex("\\p{M}")
private val WORD = Regex("[\\p{L}\\p{N}]+")

data class MindMapGroup(
    val key: String,
    val name: String?,
    val maps: List<GoalMindMap>,
)

/** The maps by the subject their chapter teaches, in the plan's order; one group without subjects. */
fun groupBySubject(maps: List<GoalMindMap>): List<MindMapGroup> =
    maps
        .groupBy { it.subject?.key.orEmpty() }
        .map { (key, inGroup) -> MindMapGroup(key, inGroup.first().subject?.name, inGroup) }
