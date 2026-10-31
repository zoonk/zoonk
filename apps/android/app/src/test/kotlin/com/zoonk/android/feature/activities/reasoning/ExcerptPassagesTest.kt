package com.zoonk.android.feature.activities.reasoning

import org.junit.Assert.assertEquals
import org.junit.Test

/** Core's `excerpt-passages.test.ts`. */
class ExcerptPassagesTest {
    private val excerpt = "On our coming near them they fired one or two shots, upon which our men rushed in."

    @Test
    fun splitsAnExcerptIntoPlainTextAndPassagesInReadingOrder() {
        val segments =
            splitExcerpt(
                excerpt,
                listOf(ExcerptPassage("rushed", "our men rushed in"), ExcerptPassage("shots", "they fired one or two shots")),
            )

        assertEquals(
            listOf(
                ExcerptSegment(null, "On our coming near them "),
                ExcerptSegment("shots", "they fired one or two shots"),
                ExcerptSegment(null, ", upon which "),
                ExcerptSegment("rushed", "our men rushed in"),
                ExcerptSegment(null, "."),
            ),
            segments,
        )
        assertEquals(excerpt, segments.joinToString("") { it.text })
    }

    @Test
    fun keepsAPassageAtTheVeryStartOrEndWithoutEmptyPieces() {
        assertEquals(
            listOf(ExcerptSegment("a", "They fired first.")),
            splitExcerpt("They fired first.", listOf(ExcerptPassage("a", "They fired first."))),
        )
    }

    @Test
    fun leavesOutPassagesThatArentInTheExcerptAndLaterOverlappingOnes() {
        val segments =
            splitExcerpt(
                excerpt,
                listOf(
                    ExcerptPassage("missing", "a volley"),
                    ExcerptPassage("shots", "fired one or two"),
                    ExcerptPassage("overlap", "two shots, upon"),
                ),
            )

        assertEquals(listOf(null, "shots", null), segments.map { it.passageId })
    }
}
