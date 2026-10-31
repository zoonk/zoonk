package com.zoonk.android.feature.activities.sorting

import com.zoonk.android.feature.activities.assignmentAnswer
import com.zoonk.android.feature.activities.seededShuffle
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf27Fields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf27FieldsDistractorsInner.Side

internal data class MatchCard(
    val id: String,
    val isTrap: Boolean,
    val text: String,
    val why: String?,
)

internal enum class MatchSide { Left, Right }

private fun sideCards(
    fields: PlayableLibraryStepAnyOfContentOneOf27Fields,
    side: MatchSide,
): List<MatchCard> {
    val pairs = fields.pairs.map { MatchCard(it.id, false, if (side == MatchSide.Left) it.left else it.right, it.why) }
    val trapSide = if (side == MatchSide.Left) Side.LEFT else Side.RIGHT
    val traps =
        fields.distractors.filter { it.side == trapSide }.mapIndexed { index, trap ->
            MatchCard("${side.name.lowercase()}-trap-$index", true, trap.text, trap.why)
        }
    return pairs + traps
}

/** Main's `arrangeMatchColumns`: both columns shuffled the same way on every load, no pair side by side. */
internal fun arrangeMatchColumns(fields: PlayableLibraryStepAnyOfContentOneOf27Fields): Pair<List<MatchCard>, List<MatchCard>> {
    val seed = fields.pairs.joinToString(" ") { it.id }
    val left = seededShuffle(sideCards(fields, MatchSide.Left), "left $seed")
    val rightCards = sideCards(fields, MatchSide.Right)
    val right =
        (0 until MAX_ATTEMPTS)
            .asSequence()
            .map { seededShuffle(rightCards, "right $it $seed") }
            .firstOrNull { candidate -> left.indices.none { !left[it].isTrap && candidate.getOrNull(it)?.id == left[it].id } }
            ?: rightCards
    return left to right
}

/** The reason a wrong pair gets: the trap's own, else the right card's, else the left one's. */
internal fun explainMismatch(
    left: MatchCard,
    right: MatchCard,
): Pair<String?, MatchCard?> {
    val trap = listOf(right, left).firstOrNull { it.isTrap }
    return (trap?.why ?: right.why ?: left.why) to trap
}

internal data class MatchProgress(
    val firstTries: Map<String, String> = emptyMap(),
    val matched: List<String> = emptyList(),
    val traps: List<String> = emptyList(),
)

internal fun isMatch(
    left: MatchCard,
    right: MatchCard,
): Boolean = !left.isTrap && left.id == right.id

/** A pair's first try is what's graded; a match locks in, and a trap that caught the learner stays marked. */
internal fun MatchProgress.recordTry(
    left: MatchCard,
    right: MatchCard,
): MatchProgress =
    MatchProgress(
        firstTries = if (left.isTrap || left.id in firstTries) firstTries else firstTries + (left.id to right.id),
        matched = if (isMatch(left, right)) matched + left.id else matched,
        traps = traps + listOf(left, right).filter { it.isTrap }.map { it.id },
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
