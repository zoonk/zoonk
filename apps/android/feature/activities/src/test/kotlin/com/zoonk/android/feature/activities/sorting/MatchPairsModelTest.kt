package com.zoonk.android.feature.activities.sorting

import com.zoonk.android.feature.activities.assignmentAnswer
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf27Fields
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Main's `match-pairs-columns.test.ts` and `match-pairs-progress.test.ts`; the layout is what main's returns. */
class MatchPairsModelTest {
    private val fields =
        ApiJson.decodeFromString<PlayableLibraryStepAnyOfContentOneOf27Fields>(
            """
            {
              "distractors": [
                {"side":"left","text":"carpeta","why":"Carpeta means folder."},
                {"side":"right","text":"embarrassed","why":"Embarrassed is avergonzado."}
              ],
              "pairs": [
                {"id":"a","left":"embarazada","right":"pregnant"},
                {"id":"b","left":"éxito","right":"success"},
                {"id":"c","left":"librería","right":"bookstore"}
              ]
            }
            """.trimIndent(),
        )
    private val columns = arrangeMatchColumns(fields)

    private fun card(id: String) = MatchCard(id, id, null)

    @Test
    fun laysOutOnlyRealPairsFromAnOlderLessonWithNoPairSideBySide() {
        assertEquals(listOf("c", "a", "b"), columns.first.map { it.id })
        assertEquals(listOf("b", "c", "a"), columns.second.map { it.id })
        assertEquals(columns, arrangeMatchColumns(fields))
    }

    @Test
    fun solvedRowsPutEachPairSideBySideInTheLeftOrder() {
        val rows = solvedRows(columns.first, columns.second).map { (left, right) -> left.id to right.id }

        assertEquals(listOf("c" to "c", "a" to "a", "b" to "b"), rows)
    }

    @Test
    fun answersOnceEveryPairIsMatchedWithTheFirstTries() {
        val partial = MatchProgress().recordTry(card("a"), card("a"))
        val done = partial.recordTry(card("b"), card("a")).recordTry(card("b"), card("b"))

        assertNull(matchAnswer(listOf("a", "b"), partial))
        assertEquals(assignmentAnswer(mapOf("a" to "a", "b" to "a")), matchAnswer(listOf("a", "b"), done))
    }
}
