package com.zoonk.android.feature.warmup

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HoldStateTest {
    @Test
    fun aLearnerWhoDidntGuessMovesOnOnceASecondPassesWithoutATouch() =
        runTest {
            val hold = HoldState()
            val touches = launch { hold.followTouches() }
            hold.touch()
            runCurrent()
            assertFalse(hold.over(ready = true))

            advanceTimeBy(800)
            hold.touch()
            advanceTimeBy(900)
            assertFalse(hold.over(ready = true))

            advanceTimeBy(101)
            assertTrue(hold.over(ready = true))
            touches.cancel()
        }

    @Test
    fun aGuessInTheQuietSecondKeepsTheLearnerPlayingUntilTheyMoveOn() =
        runTest {
            val hold = HoldState()
            val touches = launch { hold.followTouches() }
            hold.touch()
            advanceTimeBy(500)
            hold.guess()
            advanceTimeBy(5_000)

            assertTrue(hold.holding(ready = true))
            assertFalse(hold.over(ready = true))

            hold.moveOn()
            assertTrue(hold.over(ready = true))
            touches.cancel()
        }
}
