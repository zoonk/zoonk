package com.zoonk.android.feature.activities.sorting

import com.zoonk.android.feature.activities.assignmentAnswer
import com.zoonk.android.feature.activities.seededShuffle
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.feature.questions.MatchSide
import com.zoonk.android.feature.questions.MatchTry
import com.zoonk.android.feature.questions.MatchWork
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf27Fields

internal data class MatchCard(
    val id: String,
    val text: String,
    val why: String?,
)

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

/** Each left card's place with its partner's place on the right, in the left order. */
internal fun solvedRows(
    left: List<MatchCard>,
    right: List<MatchCard>,
): List<Pair<Int, Int>> = left.mapIndexed { index, card -> index to right.indexOfFirst { it.id == card.id } }

/** The board an answer left: every pair made, and each left card's first try that missed. */
internal fun workFromAnswer(
    left: List<MatchCard>,
    right: List<MatchCard>,
    firstTries: Map<String, String>?,
): MatchWork {
    if (firstTries == null) return MatchWork()
    val place = { id: String? -> right.indexOfFirst { it.id == id } }
    return MatchWork(
        pairs = solvedRows(left, right).toMap(),
        misses =
            left.mapIndexedNotNull { index, card ->
                firstTries[card.id]
                    ?.takeIf { it != card.id }
                    ?.let(place)
                    ?.takeIf { it >= 0 }
                    ?.let { MatchTry(index, it) }
            },
    )
}

/** Once every pair is matched, each left card's first try, as main's activity checks it. */
internal fun matchAnswer(
    left: List<MatchCard>,
    right: List<MatchCard>,
    work: MatchWork,
): ActivityAnswer? =
    if (work.isComplete(left.size)) {
        assignmentAnswer(work.firstTries.entries.associate { (l, r) -> left[l].id to right[r].id })
    } else {
        null
    }

private const val MAX_ATTEMPTS = 32
