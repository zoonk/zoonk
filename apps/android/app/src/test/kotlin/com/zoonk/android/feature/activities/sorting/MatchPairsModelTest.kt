package com.zoonk.android.feature.activities.sorting

import com.zoonk.android.feature.activities.assignmentAnswer
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf27Fields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf27FieldsDistractorsInner
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf27FieldsDistractorsInner.Side
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf27FieldsPairsInner
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Main's `match-pairs-columns.test.ts` and `match-pairs-progress.test.ts`; the layout is what main's returns. */
class MatchPairsModelTest {
    private val fields =
        PlayableLibraryStepAnyOfContentOneOf27Fields(
            distractors =
                listOf(
                    PlayableLibraryStepAnyOfContentOneOf27FieldsDistractorsInner(Side.RIGHT, "embarrassed", "Embarrassed is avergonzado."),
                    PlayableLibraryStepAnyOfContentOneOf27FieldsDistractorsInner(Side.LEFT, "carpeta", "Carpeta means folder."),
                ),
            pairs =
                listOf(
                    PlayableLibraryStepAnyOfContentOneOf27FieldsPairsInner("a", "embarazada", "pregnant"),
                    PlayableLibraryStepAnyOfContentOneOf27FieldsPairsInner("b", "éxito", "success"),
                    PlayableLibraryStepAnyOfContentOneOf27FieldsPairsInner("c", "librería", "bookstore", "A library is biblioteca."),
                ),
        )
    private val columns = arrangeMatchColumns(fields)

    private fun card(
        cards: List<MatchCard>,
        text: String,
    ) = cards.first { it.text == text }

    private fun card(
        id: String,
        isTrap: Boolean = false,
    ) = MatchCard(id, isTrap, id, null)

    @Test
    fun laysOutBothColumnsAsMainDoesWithNoPairSideBySide() {
        assertEquals(listOf("left-trap-0", "c", "a", "b"), columns.first.map { it.id })
        assertEquals(listOf("a", "b", "right-trap-0", "c"), columns.second.map { it.id })
        assertEquals(columns, arrangeMatchColumns(fields))
    }

    @Test
    fun namesTheTrapWithItsOwnReasonOnEitherSide() {
        val (left, right) = columns
        assertEquals(
            "Embarrassed is avergonzado." to card(right, "embarrassed"),
            explainMismatch(card(left, "embarazada"), card(right, "embarrassed")),
        )
        assertEquals("Carpeta means folder." to card(left, "carpeta"), explainMismatch(card(left, "carpeta"), card(right, "bookstore")))
    }

    @Test
    fun explainsAMixUpOfTwoPairsWithThePairsReasonIfItHasOne() {
        val (left, right) = columns
        assertEquals("A library is biblioteca." to null, explainMismatch(card(left, "librería"), card(right, "success")))
        assertEquals(null to null, explainMismatch(card(left, "éxito"), card(right, "pregnant")))
    }

    @Test
    fun keepsEachPairsFirstTryAndLocksInMatches() {
        val missed = MatchProgress().recordTry(card("a"), card("right-trap-0", isTrap = true))
        val matched = missed.recordTry(card("a"), card("a"))

        assertEquals(MatchProgress(mapOf("a" to "right-trap-0"), emptyList(), listOf("right-trap-0")), missed)
        assertEquals(MatchProgress(mapOf("a" to "right-trap-0"), listOf("a"), listOf("right-trap-0")), matched)
    }

    @Test
    fun marksALeftTrapThatCaughtTheLearnerWithoutCountingAFirstTry() {
        assertEquals(MatchProgress(traps = listOf("left-trap-0")), MatchProgress().recordTry(card("left-trap-0", isTrap = true), card("a")))
    }

    @Test
    fun answersOnceEveryPairIsMatchedWithTheFirstTries() {
        val partial = MatchProgress().recordTry(card("a"), card("a"))
        val done = partial.recordTry(card("b"), card("a")).recordTry(card("b"), card("b"))

        assertNull(matchAnswer(listOf("a", "b"), partial))
        assertEquals(assignmentAnswer(mapOf("a" to "a", "b" to "a")), matchAnswer(listOf("a", "b"), done))
    }
}
