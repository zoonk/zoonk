package com.zoonk.android.feature.activities.code

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf16FieldsMistakesInner as Mistake

// Main's `code-runner-program.test.ts`.
class CodeRunnerProgramTest {
    @Test
    fun replacesOnlyTheEditedLines() {
        val starter = "total = 0\nfor n in range(1, 100):\n    total += n\nprint(total)"

        assertEquals(
            "total = 0\nfor n in range(1, 101):\n    total += n\nprint(total)",
            programWithEdits(starter, mapOf(2 to "for n in range(1, 101):")),
        )
    }

    @Test
    fun ignoresTrailingSpacesAndBlankLinesLikeGrading() {
        assertTrue(sameOutput("5050\n", "5050"))
        assertTrue(sameOutput("a  \nb", "a\nb"))
        assertFalse(sameOutput("5050", "4950"))
    }

    @Test
    fun normalizesOutputWithJavaScriptsWhitespace() {
        assertEquals(
            listOf("a\r\nb", "x", "x \u0085\ny", "\u001C1\u001C"),
            listOf("a \t\r\nb\u00A0\n\n", "\uFEFF x \u2028", "x \u0085 \ny\t", "\u001C1\u001C").map(::normalizeProgramOutput),
        )
    }

    @Test
    fun findsTheFeedbackForTheOutputALikelyMistakePrints() {
        val mistakes = listOf(Mistake(feedback = "range stops before its end.", output = "4950"))

        assertEquals(mistakes[0], mistakeFor("4950\n", mistakes))
        assertNull(mistakeFor("5050\n", mistakes))
    }
}
