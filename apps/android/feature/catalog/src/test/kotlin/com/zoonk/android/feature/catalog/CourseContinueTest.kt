package com.zoonk.android.feature.catalog

import com.zoonk.android.app.shell.GoalSwitch
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.UUID

/**
 * A course's Continue switches to its goal in the app's scope, then Today opens, on the visit that tapped: a
 * recreation while it saves is the same visit; leaving the page first owes it nothing.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class CourseContinueTest {
    private val saves = mutableListOf<CompletableDeferred<Boolean>>()
    private val goals = GoalSwitch { CompletableDeferred<Boolean>().also { saves += it }.await() }

    private fun TestScope.continuing() = SwitchThenToday(backgroundScope) { goals.select(it, emptyList()) { true } }

    @Test
    fun aSecondTapWaitsForTheGoalToSaveAndTodayOpensOnce() =
        runTest {
            val continuing = continuing()
            continuing.switchTo(GOAL)
            continuing.switchTo(GOAL)
            runCurrent()

            assertNull(continuing.switched.value)
            saves.single().complete(true)
            runCurrent()

            assertEquals(true, continuing.switched.value)
        }

    @Test
    fun aSwitchThatSavesAfterTheLearnerLeftThePageOpensNothing() =
        runTest {
            val continuing = continuing()
            continuing.switchTo(GOAL)
            runCurrent()
            continuing.visit.end()

            saves.single().complete(true)
            runCurrent()

            assertNull(continuing.switched.value)
        }

    @Test
    fun aSwitchThatCouldntSaveSaysSoOnTheVisitThatTapped() =
        runTest {
            val continuing = continuing()
            continuing.switchTo(GOAL)
            runCurrent()
            saves.single().complete(false)
            runCurrent()

            assertEquals(false, continuing.switched.value)
        }

    @Test
    fun aSwitchThatCouldntSaveAfterTheLearnerLeftSaysNothing() =
        runTest {
            val continuing = continuing()
            continuing.switchTo(GOAL)
            runCurrent()
            continuing.visit.end()
            saves.single().complete(false)
            runCurrent()

            assertNull(continuing.switched.value)
        }

    private companion object {
        val GOAL: UUID = UUID.fromString("7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d")
    }
}
