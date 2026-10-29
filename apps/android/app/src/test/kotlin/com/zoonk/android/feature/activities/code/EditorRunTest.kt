package com.zoonk.android.feature.activities.code

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EditorRunTest {
    @Test
    fun `a run of unchanged code is current`() {
        val run = EditorRun()
        val started = run.start()!!
        assertTrue(run.isRunning)

        assertTrue(run.finish(started))
        assertFalse(run.isRunning)
        assertFalse(run.isStale)
    }

    @Test
    fun `starts one run at a time`() {
        val run = EditorRun()
        val started = run.start()!!
        assertNull(run.start())

        run.finish(started)
        assertEquals(0, run.start())
    }

    @Test
    fun `an edit marks the shown result stale until code that wasn't edited meanwhile runs`() {
        val run = EditorRun()
        run.finish(run.start()!!)
        run.edit()
        assertTrue(run.isStale)

        val started = run.start()!!
        run.edit()
        assertFalse(run.finish(started))
        assertTrue(run.isStale)

        assertTrue(run.finish(run.start()!!))
        assertFalse(run.isStale)
    }
}
