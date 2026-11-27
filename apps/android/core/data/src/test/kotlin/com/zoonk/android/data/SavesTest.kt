package com.zoonk.android.data

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SavesTest {
    private val dispatcher = StandardTestDispatcher()
    private val visit = Visit()
    private val sent = mutableListOf<Pair<String, Boolean>>()
    private var hold: CompletableDeferred<Unit>? = null
    private var answer: (Boolean) -> MutationResult<Boolean> = { MutationResult.Done(it) }

    private fun TestScope.saves(
        queue: Saves<String> = Saves(this),
        on: Visit = visit,
    ) = queue.on(on) { key, saved ->
        sent += key to saved
        hold?.await()
        answer(saved)
    }

    @Test
    fun tapsWhileASaveIsOnItsWayEndOnTheLastOneAndKeepWhatTheServerStored() =
        runTest(dispatcher) {
            val saves = saves()
            val first = CompletableDeferred<Unit>().also { hold = it }

            saves.set("cells", true)
            advanceUntilIdle()
            saves.set("cells", false)
            saves.set("cells", true)
            saves.set("cells", false)
            assertEquals(false, saves.states.value["cells"])

            hold = null
            first.complete(Unit)
            advanceUntilIdle()

            assertEquals(listOf("cells" to true, "cells" to false), sent)
            assertEquals(false, saves.states.value["cells"])
        }

    @Test
    fun aTapOnAnotherScreenShowsOnEveryScreenAndAFailureIsSaidWhereTheNewestTapWas() =
        runTest(dispatcher) {
            val queue = Saves<String>(this)
            val list = saves(queue)
            val player = saves(queue, Visit())
            val first = CompletableDeferred<Unit>().also { hold = it }

            list.set("cells", true)
            advanceUntilIdle()
            player.set("cells", false)
            assertEquals(false, list.states.value["cells"])

            answer = { MutationResult.Failed(ApiError.Network) }
            first.complete(Unit)
            advanceUntilIdle()

            assertEquals(listOf("cells" to true), sent)
            assertNull(list.states.value["cells"])
            assertNull(list.failed.value)
            assertEquals(SaveFailure.Save, player.failed.value)
        }

    @Test
    fun aFailedRemovalGoesBackAndSaysItWasARemoval() =
        runTest(dispatcher) {
            val saves = saves()
            answer = { MutationResult.Failed(ApiError.Network) }

            saves.set("cells", false)
            advanceUntilIdle()

            assertNull(saves.states.value["cells"])
            assertEquals(SaveFailure.Remove, saves.failed.value)
        }

    @Test
    fun aFailureThatLandsAfterTheVisitEndedSaysNothing() =
        runTest(dispatcher) {
            val saves = saves()
            hold = CompletableDeferred()
            answer = { MutationResult.Failed(ApiError.Network) }

            saves.set("cells", true)
            advanceUntilIdle()
            visit.end()
            hold?.complete(Unit)
            advanceUntilIdle()

            assertNull(saves.failed.value)
        }

    @Test
    fun whatTheServerStoredGivesWayToTheReadsOnTheNextVisit() =
        runTest(dispatcher) {
            val saves = saves()

            saves.set("cells", false)
            advanceUntilIdle()
            assertEquals(false, saves.states.value["cells"])

            visit.end()

            assertNull(saves.states.value["cells"])
        }

    @Test
    fun aRowChangedOnTheVisitKeepsItsPlaceAsTheListIsReadAgain() {
        val kept = KeptRows<String, String> { it }
        val touched = mutableSetOf<String>()
        assertEquals(listOf("a", "b", "c"), kept.arrange(listOf("a", "b", "c"), touched::contains))

        // Removed here: the next read leaves it out, the page keeps it where it was.
        touched += "b"
        assertEquals(listOf("a", "b", "c"), kept.arrange(listOf("a", "c"), touched::contains))

        // Saved again: the server lists it first now, as the newest save; it stays put.
        assertEquals(listOf("a", "b", "c"), kept.arrange(listOf("b", "a", "c"), touched::contains))

        // Removed on another device: untouched here, so it goes.
        assertEquals(listOf("b", "c"), kept.arrange(listOf("b", "c"), touched::contains))
    }

    @Test
    fun aKeptRowThatCanNoLongerOpenShowsOnlyAmongTheGoneOnes() {
        data class Row(
            val key: String,
            val available: Boolean,
        )

        val kept = KeptRows<Row, String> { it.key }
        kept.arrange(listOf(Row("a", true), Row("b", true)), { false })

        // Removed and saved again here, then the lesson stopped opening: the newest read says so.
        val rows = kept.arrange(listOf(Row("a", false), Row("b", true)), { it == "a" })
        val sections = rows.saveSections({ it.available }) { true }

        assertEquals(listOf("b"), sections.opens.map { it.key })
        assertEquals(listOf("a"), sections.gone.map { it.key })
    }

    @Test
    fun theNextVisitShowsTheListAsRead() {
        val kept = KeptRows<String, String> { it }
        kept.arrange(listOf("a", "b"), { false })
        kept.arrange(listOf("a"), { it == "b" })

        kept.clear()

        assertEquals(listOf("a"), kept.arrange(listOf("a"), { it == "b" }))
    }
}
