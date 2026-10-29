package com.zoonk.android.app.shell

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class GoalSwitchTest {
    private val goal = UUID.fromString("00000000-0000-0000-0000-000000000002")

    @Test
    fun aSavedSwitchStaysPendingUntilTheTabsShowTheGoal() =
        runTest {
            val switch = GoalSwitch { true }

            assertTrue(switch.select(goal, shown = emptyList(), shows = { false }))
            assertEquals(goal, switch.pending.value)
            switch.settle(goal)
            assertNull(switch.pending.value)
        }

    @Test
    fun aRefusedSwitchEndsAtOnce() =
        runTest {
            val switch = GoalSwitch { false }

            assertFalse(switch.select(goal, shown = emptyList(), shows = { false }))
            assertNull(switch.pending.value)
        }

    @Test
    fun aSecondPickWhileSavingIsIgnored() =
        runTest {
            val saved = CompletableDeferred<Boolean>()
            val made = mutableListOf<UUID>()
            val switch =
                GoalSwitch {
                    made += it
                    saved.await()
                }

            launch { switch.select(goal, shown = emptyList(), shows = { true }) }
            runCurrent()
            assertTrue(switch.saving.value)
            switch.select(UUID.randomUUID(), shown = emptyList(), shows = { true })
            saved.complete(true)
            runCurrent()

            assertEquals(listOf(goal), made)
            assertFalse(switch.saving.value)
            assertNull(switch.pending.value)
        }
}
