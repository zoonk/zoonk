package com.zoonk.android.ui.format

import android.icu.text.BreakIterator
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

@RunWith(AndroidJUnit4::class)
class FactsLineTest {
    @Test
    fun wrappedFactKeepsTheSeparatorWithTheFactThatFollowsIt() {
        val day = "Saturday"
        val questions = "12 questions"
        val line = factsLine(day, questions, null, "20 min")
        val breaks = BreakIterator.getLineInstance(Locale.ENGLISH).apply { setText(line) }

        assertTrue(breaks.isBoundary(line.indexOf('·')))
        assertFalse(breaks.isBoundary(line.indexOf(questions)))
    }
}
