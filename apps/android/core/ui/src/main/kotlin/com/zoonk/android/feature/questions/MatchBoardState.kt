package com.zoonk.android.feature.questions

import android.content.res.Resources
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.Stable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.hapticfeedback.HapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalResources
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityAnnouncement
import com.zoonk.android.ui.format.joinSentences
import kotlinx.coroutines.delay

/**
 * One match board's taps, for every screen that asks to match these with those (main's `useMatchBoard`): what each tap
 * does to the [work], a light tap on the hand for a right pair and a firm one for a miss, the brief wrong cue, and one
 * line for TalkBack per try or undone pair ([Announcement]). [count] is how many cards each column holds.
 */
@Stable
class MatchBoardState internal constructor(
    private val state: MutableState<MatchWork>,
    private val count: Int,
    private val goesWith: State<((left: Int, right: Int) -> Boolean)?>,
    private val name: State<(MatchSpot) -> String>,
    private val why: State<(MatchTry) -> String?>,
    private val haptics: HapticFeedback,
    private val resources: Resources,
) {
    val work: MatchWork get() = state.value

    var announcement by mutableStateOf("")
        private set

    /** The last try while it was a wrong one, until a pair is made; a screen that says why shows it this long. */
    val lastMiss: MatchTry? get() = work.missed

    /** Whether the board checks each pair as it's made. */
    private val checksPairs: Boolean get() = goesWith.value != null

    val isComplete: Boolean get() = work.isComplete(count)

    /** The board after [spot]'s tap, already shown. */
    fun tap(spot: MatchSpot): MatchWork {
        val before = state.value
        val next = before.tap(spot, goesWith.value)
        state.value = next

        val made = next.pairs.keys - before.pairs.keys
        val undone = before.pairs.keys - next.pairs.keys
        when {
            made.isNotEmpty() -> paired(made.first().let { MatchTry(it, next.pairs.getValue(it)) }, next.pairs.size)
            undone.isNotEmpty() -> unpaired(undone.first().let { MatchTry(it, before.pairs.getValue(it)) })
            next.misses.size > before.misses.size -> missed(next.misses.last())
        }
        return next
    }

    /** What TalkBack calls [spot]'s card once it's in a pair: its words and its [partner]'s, on the other side. */
    fun label(
        spot: MatchSpot,
        partner: Int?,
    ): String? =
        partner?.let {
            resources.getString(R.string.questions_matched_with, name.value(spot), name.value(MatchSpot(spot.side.other, it)))
        }

    private fun words(pair: MatchTry) =
        name.value(MatchSpot(MatchSide.Left, pair.left)) to name.value(MatchSpot(MatchSide.Right, pair.right))

    private fun paired(
        pair: MatchTry,
        made: Int,
    ) {
        if (checksPairs) haptics.performHapticFeedback(HapticFeedbackType.Confirm)
        val (left, right) = words(pair)
        announcement = resources.getQuantityString(R.plurals.questions_match_paired, made, left, right, made, count)
    }

    private fun unpaired(pair: MatchTry) {
        val (left, right) = words(pair)
        announcement = resources.getString(R.string.questions_match_unpaired, left, right)
    }

    private fun missed(miss: MatchTry) {
        haptics.performHapticFeedback(HapticFeedbackType.Reject)
        val (left, right) = words(miss)
        announcement = listOfNotNull(resources.getString(R.string.questions_match_not_a_pair, left, right), why.value(miss)).joinSentences()
    }

    internal fun endWrongCue() {
        state.value = state.value.copy(wrong = null)
    }

    internal fun endLockedCue() {
        state.value = state.value.copy(locked = null)
    }
}

/**
 * A board of [count] cards a side that checks each pair with [goesWith], or holds every pair until Check without it.
 * [name] is what TalkBack calls a card, and [why] says why a miss doesn't go together, where the screen knows. The work
 * starts from [initial] and survives the process; keyed by [keys], a new question starts a new board.
 */
@Composable
fun rememberMatchBoardState(
    count: Int,
    goesWith: ((left: Int, right: Int) -> Boolean)?,
    name: (MatchSpot) -> String,
    vararg keys: Any?,
    why: (MatchTry) -> String? = { null },
    initial: () -> MatchWork = { MatchWork() },
): MatchBoardState {
    val work = rememberSaveable(*keys, stateSaver = MatchWorkSaver) { mutableStateOf(initial()) }
    val checks = rememberUpdatedState(goesWith)
    val names = rememberUpdatedState(name)
    val whys = rememberUpdatedState(why)
    val haptics = LocalHapticFeedback.current
    val resources = LocalResources.current
    val board = remember(work, count, haptics, resources) { MatchBoardState(work, count, checks, names, whys, haptics, resources) }

    // A try's tone holds through the wrong one's shake and a beat after it; a tap during it is a tap like any other. A
    // locked pair keeps its own clock, so a miss or a pick doesn't cut it short; only a newer pair settles it at once.
    val shown = work.value
    LaunchedEffect(shown.wrong, shown.cue) {
        if (shown.wrong != null) {
            delay(WRONG_CUE_MILLIS)
            board.endWrongCue()
        }
    }
    LaunchedEffect(shown.locked) {
        if (shown.locked != null) {
            delay(WRONG_CUE_MILLIS)
            board.endLockedCue()
        }
    }
    return board
}

/** What TalkBack hears after each try; nothing is drawn. */
@Composable
fun MatchBoardState.Announcement() = ActivityAnnouncement(announcement)

/** How long a try's tone shows: a wrong one's shake, then a beat to see which two it was; a right one as long. */
internal const val WRONG_CUE_MILLIS = 600L
