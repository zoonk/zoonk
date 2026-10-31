package com.zoonk.android.feature.mindmaps

import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.api.models.AllowanceItem
import com.zoonk.api.models.AllowanceResponse
import com.zoonk.api.models.ChapterMindMap
import com.zoonk.api.models.GoalMindMap
import java.text.Normalizer

/** What a map's tile or card says, from the server's status and what this screen asked for. */
enum class MindMapShown { Unavailable, Available, Generating, Ready, Failed, Refused, Unreachable }

/** What a screen did about one map: its request's answer, and whether following it got stuck. */
data class MindMapLocal(
    val shown: MindMapShown? = null,
    val limit: Limit? = null,
    val pending: Boolean = false,
    val stuck: Boolean = false,
)

/**
 * Main's `useMindMapRequest`: the server's ready wins; a poll that got stuck says it couldn't reach
 * the server; a map this screen saw finish shows as still drawing until the server's read says so.
 */
fun shownMindMap(
    server: MindMapShown,
    local: MindMapLocal?,
): MindMapShown =
    when {
        server == MindMapShown.Ready -> MindMapShown.Ready
        local?.stuck == true -> MindMapShown.Unreachable
        local?.shown == MindMapShown.Ready -> MindMapShown.Generating
        else -> local?.shown ?: server
    }

val GoalMindMap.Status.shown: MindMapShown
    get() =
        when (this) {
            GoalMindMap.Status.AVAILABLE -> MindMapShown.Available
            GoalMindMap.Status.GENERATING -> MindMapShown.Generating
            GoalMindMap.Status.READY -> MindMapShown.Ready
            GoalMindMap.Status.FAILED -> MindMapShown.Failed
        }

val ChapterMindMap.Status.shown: MindMapShown
    get() =
        when (this) {
            ChapterMindMap.Status.UNAVAILABLE -> MindMapShown.Unavailable
            ChapterMindMap.Status.AVAILABLE -> MindMapShown.Available
            ChapterMindMap.Status.GENERATING -> MindMapShown.Generating
            ChapterMindMap.Status.READY -> MindMapShown.Ready
            ChapterMindMap.Status.FAILED -> MindMapShown.Failed
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
