package com.zoonk.android.feature.activities.sorting

import com.zoonk.android.feature.activities.assignmentAnswer
import com.zoonk.android.feature.activities.seededShuffle
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf27Fields

internal data class MatchCard(
    val id: String,
    val text: String,
    val why: String?,
)

internal enum class MatchSide { Left, Right }

private fun sideCards(
    fields: PlayableLibraryStepAnyOfContentOneOf27Fields,
    side: MatchSide,
): List<MatchCard> = fields.pairs.map { MatchCard(it.id, if (side == MatchSide.Left) it.left else it.right, it.why) }

/** Main's `arrangeMatchColumns`: both columns shuffled the same way on every load, no pair side by side. */
internal fun arrangeMatchColumns(fields: PlayableLibraryStepAnyOfContentOneOf27Fields): Pair<List<MatchCard>, List<MatchCard>> {
    val seed = fields.pairs.joinToString(" ") { it.id }
    val left = seededShuffle(sideCards(fields, MatchSide.Left), "left $seed")
    val rightCards = sideCards(fields, MatchSide.Right)
    val right =
        (0 until MAX_ATTEMPTS)
            .asSequence()
            .map { seededShuffle(rightCards, "right $it $seed") }
            .firstOrNull { candidate -> left.indices.none { candidate[it].id == left[it].id } }
            ?: rightCards
    return left to right
}

internal fun solvedRows(
    left: List<MatchCard>,
    right: List<MatchCard>,
): List<Pair<MatchCard, MatchCard>> {
    val partners = right.associateBy { it.id }
    return left.map { card -> card to partners.getValue(card.id) }
}

internal data class MatchProgress(
    val firstTries: Map<String, String> = emptyMap(),
    val matched: List<String> = emptyList(),
)

internal fun MatchProgress.recordTry(
    left: MatchCard,
    right: MatchCard,
): MatchProgress =
    MatchProgress(
        firstTries = if (left.id in firstTries) firstTries else firstTries + (left.id to right.id),
        matched = if (left.id == right.id) matched + left.id else matched,
    )

internal fun matchAnswer(
    pairIds: List<String>,
    progress: MatchProgress,
): ActivityAnswer? =
    if (pairIds.all { it in progress.matched }) {
        assignmentAnswer(pairIds.associateWith { progress.firstTries[it] ?: it })
    } else {
        null
    }

internal fun progressFromAnswer(pairs: Map<String, String>?): MatchProgress =
    pairs?.let { MatchProgress(firstTries = it, matched = it.keys.toList()) } ?: MatchProgress()

private const val MAX_ATTEMPTS = 32
