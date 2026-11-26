package com.zoonk.android.feature.questions

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.saveable.Saver

/** Which column of a match board a card sits in. */
enum class MatchSide { Left, Right }

val MatchSide.other: MatchSide get() = if (this == MatchSide.Left) MatchSide.Right else MatchSide.Left

/** A card on a match board: its column and its shown place in it. */
data class MatchSpot(
    val side: MatchSide,
    val index: Int,
)

/**
 * What the learner did on a match board (main's `useMatchBoard`): the [pairs] made, left place to right place; every
 * wrong try in the order it happened; the card picked first, waiting for its partner; and the try whose cue shows, a
 * [wrong] one or the left place of a pair just [locked] ([cue] counts the tries, so the same miss twice cues twice).
 */
@Immutable
data class MatchWork(
    val pairs: Map<Int, Int> = emptyMap(),
    val misses: List<MatchTry> = emptyList(),
    val picked: MatchSpot? = null,
    val wrong: MatchTry? = null,
    val locked: Int? = null,
    val cue: Int = 0,
) {
    fun partnerOf(spot: MatchSpot): Int? =
        when (spot.side) {
            MatchSide.Left -> pairs[spot.index]
            MatchSide.Right -> pairs.entries.firstOrNull { it.value == spot.index }?.key
        }

    /** Every left place in a pair. */
    fun isComplete(count: Int): Boolean = count > 0 && (0 until count).all { it in pairs }

    /** Each left place's first try: the right place of its first miss, or of its pair. */
    val firstTries: Map<Int, Int>
        get() = pairs + misses.reversed().associate { it.left to it.right }

    /**
     * How [spot]'s card shows: a held pair; on the [ended] board a pair kept, marked missed when its left card had a wrong
     * try, or a card it only shows; while playing a pair just locked, then done; a wrong try's cue over the pick it
     * keeps, the card picked first, or none of these.
     */
    fun stateOf(
        spot: MatchSpot,
        held: Boolean,
        ended: Boolean,
    ): MatchEntryState {
        val partner = partnerOf(spot)
        val left = if (spot.side == MatchSide.Left) spot.index else partner
        val cued = wrong?.let { if (spot.side == MatchSide.Left) it.left == spot.index else it.right == spot.index } == true
        return when {
            partner != null && held -> MatchEntryState.Paired
            partner != null && ended -> if (misses.any { it.left == left }) MatchEntryState.Missed else MatchEntryState.Right
            partner != null -> if (locked == left) MatchEntryState.Right else MatchEntryState.Done
            ended -> MatchEntryState.Shown
            cued -> MatchEntryState.Wrong
            picked == spot -> MatchEntryState.Selected
            else -> MatchEntryState.Idle
        }
    }

    /** Each left place's partner, as an answer sends it: with its misses on a board checked pair by pair. */
    fun answer(
        count: Int,
        checked: Boolean,
    ): Answer.Matches =
        Answer.Matches(
            (0 until count).map { pairs.getValue(it) },
            misses.take(MAX_MATCH_MISSES).takeIf { checked },
        )
}

/**
 * A tap on [spot]. A card picks first, on either side; another card on the same side takes its place, and the picked
 * card again lets go. A card on the other side makes a try: with [goesWith] the board checks it, keeping a right pair
 * and counting a wrong one while the first card stays picked for the next try; without it the board holds any pair
 * until Check, and a paired card tapped again undoes its pair.
 */
fun MatchWork.tap(
    spot: MatchSpot,
    goesWith: ((left: Int, right: Int) -> Boolean)?,
): MatchWork {
    val partner = partnerOf(spot)
    if (partner != null) {
        if (goesWith != null) return this
        val left = if (spot.side == MatchSide.Left) spot.index else partner
        return copy(pairs = pairs - left, picked = null, wrong = null)
    }

    val first = picked
    if (first == null || first.side == spot.side) return copy(picked = spot.takeUnless { it == first }, wrong = null)

    val attempt = if (spot.side == MatchSide.Left) MatchTry(spot.index, first.index) else MatchTry(first.index, spot.index)
    if (goesWith == null) return copy(pairs = pairs + (attempt.left to attempt.right), picked = null, wrong = null)
    if (goesWith(attempt.left, attempt.right)) {
        return copy(pairs = pairs + (attempt.left to attempt.right), picked = null, wrong = null, locked = attempt.left, cue = cue + 1)
    }
    return copy(misses = misses + attempt, wrong = attempt, locked = null, cue = cue + 1)
}

/** The board as it was, for a process Android reclaimed: its pairs, misses and pick, without a cue that already ended. */
val MatchWorkSaver: Saver<MatchWork, Any> =
    Saver(
        save = { work ->
            arrayListOf(
                ArrayList(work.pairs.flatMap { (left, right) -> listOf(left, right) }),
                ArrayList(work.misses.flatMap { listOf(it.left, it.right) }),
                arrayListOf(work.picked?.side?.ordinal ?: -1, work.picked?.index ?: -1),
            )
        },
        restore = { saved ->
            @Suppress("UNCHECKED_CAST")
                val (pairs, misses, picked) = saved as List<List<Int>>
            MatchWork(
                pairs = pairs.chunked(2).associate { (left, right) -> left to right },
                misses = misses.chunked(2).map { (left, right) -> MatchTry(left, right) },
                picked = picked.takeIf { it[0] >= 0 }?.let { (side, index) -> MatchSpot(MatchSide.entries[side], index) },
            )
        },
    )
