package com.zoonk.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** An outcome is held for its visit until the screen acts on it; ending the visit clears it, and a late one is dropped. */
class VisitTest {
    private val visit = Visit()
    private val opened = visit.outcome<String>()

    @Test
    fun anOutcomeAScreenWentBeforeActingOnStaysForTheScreenShownNext() {
        opened.send(visit.number, "certificate")
        // The screen that got it was recreated before acting: nothing acknowledged it.

        assertEquals("certificate", opened.value)
        opened.acted("certificate")
        assertNull(opened.value)
    }

    @Test
    fun endingTheVisitClearsWhatsOwedToItAndDropsALateOutcome() {
        val started = visit.number
        val failure = visit.outcome<Unit>()
        opened.send(started, "certificate")
        failure.send(started, Unit)

        visit.end()
        failure.send(started, Unit)

        assertNull(opened.value)
        assertNull(failure.value)
    }

    @Test
    fun actingOnAnOlderOutcomeKeepsANewerOne() {
        opened.send(visit.number, "first")
        opened.send(visit.number, "second")

        opened.acted("first")

        assertEquals("second", opened.value)
    }

    @Test
    fun anOpeningEndsOnItsOwnAndWithTheScreensVisit() {
        val editor = visit.opening()
        val picked = editor.outcome<Unit>()
        val first = editor.number

        editor.end()
        picked.send(first, Unit)
        assertNull(picked.value)
        assertEquals(0, visit.number)

        picked.send(editor.number, Unit)
        visit.end()
        assertNull(picked.value)
    }
}
