package com.zoonk.android.feature.questions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** What each tap does to a match board. */
class MatchWorkTest {
    /** Left 0 goes with right 1, and left 1 with right 0. */
    private val key = listOf(1, 0)
    private val goesWith = { l: Int, r: Int -> key[l] == r }

    private fun left(index: Int) = MatchSpot(MatchSide.Left, index)

    private fun right(index: Int) = MatchSpot(MatchSide.Right, index)

    private fun MatchWork.taps(
        vararg spots: MatchSpot,
        check: ((Int, Int) -> Boolean)? = goesWith,
    ) = spots.fold(this) { work, spot -> work.tap(spot, check) }

    @Test
    fun eitherSideCanGoFirstAndARightPairLocks() {
        val work = MatchWork().taps(right(0), left(1))

        assertEquals(mapOf(1 to 0), work.pairs)
        assertNull(work.picked)
        assertEquals(work, work.taps(left(1), right(0)))
    }

    @Test
    fun aMissKeepsTheFirstCardPickedAndCountsInOrder() {
        val work = MatchWork().taps(left(0), right(0))

        assertEquals(left(0), work.picked)
        assertEquals(MatchTry(0, 0), work.wrong)
        assertEquals(listOf(MatchTry(0, 0)), work.misses)

        val done = work.taps(right(1), right(0), left(1))
        assertTrue(done.isComplete(2))
        assertEquals(Answer.Matches(listOf(1, 0), listOf(MatchTry(0, 0))), done.answer(2, checked = true))
        assertEquals(mapOf(0 to 0, 1 to 0), done.firstTries)
    }

    @Test
    fun theSameMissTwiceCuesTwiceAndATapEndsTheCue() {
        val once = MatchWork().taps(left(0), right(0))
        val twice = once.taps(right(0))

        assertEquals(once.cue + 1, twice.cue)
        assertEquals(2, twice.misses.size)
        assertNull(twice.taps(left(1)).wrong)
    }

    @Test
    fun aPickChangesOnItsSideAndLetsGoWhenTappedAgain() {
        assertEquals(left(1), MatchWork().taps(left(0), left(1)).picked)
        assertNull(MatchWork().taps(left(0), left(0)).picked)
    }

    @Test
    fun aHeldBoardKeepsAnyPairUntilCheckAndUndoesFromEitherSide() {
        val held = MatchWork().taps(left(0), right(0), check = null)

        assertEquals(mapOf(0 to 0), held.pairs)
        assertTrue(held.misses.isEmpty())
        assertTrue(held.taps(right(0), check = null).pairs.isEmpty())
        assertFalse(held.isComplete(2))
        assertEquals(Answer.Matches(listOf(0, 1)), held.taps(left(1), right(1), check = null).answer(2, checked = false))
    }

    @Test
    fun anAnswerSendsOnlyTheEarliestMissesTheApiTakes() {
        val misses = (0 until MAX_MATCH_MISSES + 5).fold(MatchWork().taps(left(0))) { work, _ -> work.taps(right(0)) }
        val done = misses.taps(right(1), left(1), right(0))

        assertEquals(MAX_MATCH_MISSES, done.answer(2, checked = true).misses?.size)
    }

    @Test
    fun aKeptPairIgnoresTapsAndSettlesOnceItsCueEnds() {
        val locked = MatchWork().taps(left(0), right(1))
        val settled = locked.copy(locked = null)

        assertEquals(locked, locked.taps(left(0)))
        assertEquals(MatchEntryState.Right, locked.stateOf(right(1), held = false, ended = false))
        assertEquals(MatchEntryState.Done, settled.stateOf(left(0), held = false, ended = false))
        assertEquals(MatchEntryState.Done, locked.taps(left(1), right(0)).stateOf(left(0), held = false, ended = false))
        assertEquals(MatchEntryState.Shown, locked.stateOf(left(1), held = false, ended = true))
    }

    @Test
    fun aFinishedBoardMarksBothCardsOfEachPairItsLeftCardFirstMissed() {
        val done = MatchWork().taps(left(0), right(0), right(1), left(1), right(0))

        assertEquals(MatchEntryState.Missed, done.stateOf(left(0), held = false, ended = true))
        assertEquals(MatchEntryState.Missed, done.stateOf(right(1), held = false, ended = true))
        assertEquals(MatchEntryState.Right, done.stateOf(left(1), held = false, ended = true))
        assertEquals(MatchEntryState.Right, done.stateOf(right(0), held = false, ended = true))
    }

    @Test
    fun aMissOrAPickLeavesAJustLockedPairItsOwnCue() {
        val board = listOf(0, 1, 2)
        val check = { l: Int, r: Int -> board[l] == r }
        val locked = MatchWork().taps(left(0), right(0), check = check)

        assertEquals(0, locked.taps(left(1), check = check).locked)
        assertEquals(0, locked.taps(left(1), right(2), check = check).locked)
        assertEquals(1, locked.taps(left(1), right(1), check = check).locked)
    }

    @Test
    fun aMissStaysSaidThroughTheNextPicksUntilAPairIsMade() {
        val missed = MatchWork().taps(left(0), right(0))

        assertEquals(MatchTry(0, 0), missed.missed)
        assertEquals(MatchTry(0, 0), missed.taps(left(1)).missed)
        assertNull(missed.taps(right(1)).missed)
    }
}
