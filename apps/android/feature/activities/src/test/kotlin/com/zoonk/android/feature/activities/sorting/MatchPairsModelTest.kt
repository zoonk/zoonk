package com.zoonk.android.feature.activities.sorting

import com.zoonk.android.feature.activities.assignmentAnswer
import com.zoonk.android.feature.activities.assignmentPairs
import com.zoonk.android.feature.questions.MatchSide
import com.zoonk.android.feature.questions.MatchSpot
import com.zoonk.android.feature.questions.MatchWork
import com.zoonk.android.feature.questions.tap
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

    @Test
    fun laysOutOnlyRealPairsFromAnOlderLessonWithNoPairSideBySide() {
        assertEquals(listOf("c", "a", "b"), columns.first.map { it.id })
        assertEquals(listOf("b", "c", "a"), columns.second.map { it.id })
        assertEquals(columns, arrangeMatchColumns(fields))
    }

    @Test
    fun solvedRowsPutEachPairSideBySideInTheLeftOrder() {
        val (left, right) = columns
        val rows = solvedRows(left, right).map { (l, r) -> left[l].id to right[r].id }

        assertEquals(listOf("c" to "c", "a" to "a", "b" to "b"), rows)
    }

    @Test
    fun answersOnceEveryPairIsMatchedWithTheFirstTries() {
        val (left, right) = columns
        val goesWith = { l: Int, r: Int -> left[l].id == right[r].id }

        fun MatchWork.pick(
            side: MatchSide,
            id: String,
        ) = tap(MatchSpot(side, (if (side == MatchSide.Left) left else right).indexOfFirst { it.id == id }), goesWith)

        val partial = MatchWork().pick(MatchSide.Left, "a").pick(MatchSide.Right, "a")
        val done =
            partial
                .pick(MatchSide.Right, "a")
                .pick(MatchSide.Left, "b")
                .pick(MatchSide.Right, "c")
                .pick(MatchSide.Right, "b")
                .pick(MatchSide.Left, "c")
                .pick(MatchSide.Right, "c")

        assertNull(matchAnswer(left, right, partial))
        val answer = assignmentAnswer(mapOf("a" to "a", "b" to "c", "c" to "c"))
        assertEquals(answer, matchAnswer(left, right, done))
        assertEquals(done.pairs, workFromAnswer(left, right, answer.assignmentPairs).pairs)
        assertEquals(done.firstTries, workFromAnswer(left, right, answer.assignmentPairs).firstTries)
    }
}
