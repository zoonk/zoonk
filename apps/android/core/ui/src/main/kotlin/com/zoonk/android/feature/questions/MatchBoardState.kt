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
 * line for TalkBack per try ([Announcement]). [count] is how many cards each column holds.
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

    /** The wrong try the last tap made, until the next tap; a screen that says why shows it this long. */
    var lastMiss by mutableStateOf<MatchTry?>(null)
        private set

    /** Whether the board checks each pair as it's made. */
    val checksPairs: Boolean get() = goesWith.value != null

    val isComplete: Boolean get() = work.isComplete(count)

    /** The board after [spot]'s tap, already shown. */
    fun tap(spot: MatchSpot): MatchWork {
        val before = state.value
        val next = before.tap(spot, goesWith.value)
        state.value = next

        val made = next.pairs.keys - before.pairs.keys
        lastMiss = next.misses.lastOrNull()?.takeIf { next.misses.size > before.misses.size }
        when {
            made.isNotEmpty() -> {
                val left = made.first()
                paired(MatchTry(left, next.pairs.getValue(left)), next.pairs.size)
            }

            next.misses.size > before.misses.size -> {
                missed(next.misses.last())
            }
        }
        return next
    }

    private fun paired(
        pair: MatchTry,
        made: Int,
    ) {
        val left = name.value(MatchSpot(MatchSide.Left, pair.left))
        val right = name.value(MatchSpot(MatchSide.Right, pair.right))
        announcement =
            if (checksPairs) {
                haptics.performHapticFeedback(HapticFeedbackType.Confirm)
                resources.getString(R.string.questions_match_paired, left, right, made, count)
            } else {
                resources.getString(R.string.questions_matched_with, right, left)
            }
    }

    private fun missed(miss: MatchTry) {
        haptics.performHapticFeedback(HapticFeedbackType.Reject)
        val left = name.value(MatchSpot(MatchSide.Left, miss.left))
        val right = name.value(MatchSpot(MatchSide.Right, miss.right))
        announcement = listOfNotNull(resources.getString(R.string.questions_match_not_a_pair, left, right), why.value(miss)).joinSentences()
    }

    internal fun endCue() {
        state.value = state.value.copy(wrong = null)
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

    // The wrong tone holds only as long as the shake; a tap during it is a tap like any other.
    val cue = work.value.cue
    LaunchedEffect(cue) {
        if (work.value.wrong != null) {
            delay(WRONG_CUE_MILLIS)
            board.endCue()
        }
    }
    return board
}

/** What TalkBack hears after each try; nothing is drawn. */
@Composable
fun MatchBoardState.Announcement() = ActivityAnnouncement(announcement)

/** Main's `animate-shake` (0.4 s), after which the wrong tone gives way. */
internal const val WRONG_CUE_MILLIS = 400L
