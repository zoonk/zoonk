package com.zoonk.android.feature.activities.sorting

import com.zoonk.android.feature.activities.assignmentAnswer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Main's `labeled-diagram-model.test.ts`. */
class LabeledDiagramModelTest {
    private val slots = diagramSlots(listOf("Aorta", "Right atrium", "Left atrium", "Left ventricle"))

    @Test
    fun numbersTheSpotsInThePicturesOrderTheFirstPartAsOne() {
        assertEquals(
            listOf(
                Triple(1, "1", "Aorta"),
                Triple(2, "2", "Right atrium"),
                Triple(3, "3", "Left atrium"),
                Triple(4, "4", "Left ventricle"),
            ),
            slots.map { Triple(it.number, it.key, it.label) },
        )
    }

    @Test
    fun movesANameThatWasAlreadyOnAnotherSpot() {
        assertEquals(mapOf("2" to "Aorta"), placeName(mapOf("1" to "Aorta"), "2", "Aorta"))
    }

    @Test
    fun replacesTheNameOnTheSpotSendingTheOldOneBackToTheBank() {
        val placements = placeName(mapOf("1" to "Aorta"), "1", "Valve")
        assertEquals(mapOf("1" to "Valve"), placements)
        assertEquals(listOf("Aorta", "Septum"), unplacedNames(listOf("Aorta", "Valve", "Septum"), placements))
    }

    @Test
    fun findsTheNextEmptySpotAfterTheCurrentOneWrappingAround() {
        assertEquals("4", nextEmptySlot(slots, "2", mapOf("3" to "L")))
        assertEquals("1", nextEmptySlot(slots, "4", mapOf("3" to "L")))
        assertEquals("1", nextEmptySlot(slots, null, emptyMap()))
        assertNull(nextEmptySlot(slots, "1", mapOf("1" to "A", "2" to "R", "3" to "L", "4" to "V")))
    }

    @Test
    fun answersOnlyWhenEverySpotHasAName() {
        val partial = mapOf("1" to "Aorta", "2" to "Right atrium")
        val full = partial + mapOf("3" to "Left atrium", "4" to "Left ventricle")
        assertNull(diagramAnswer(slots, partial))
        assertEquals(assignmentAnswer(full), diagramAnswer(slots, full))
        assertNull(diagramAnswer(slots, full - "4"))
    }

    @Test
    fun givesTheFeedbackForExactlyTheMixUpTheLearnerMade() {
        val mixUps = listOf("It faces you." to listOf("Right atrium", "Left atrium"))
        assertEquals("It faces you.", mixUpFeedback("Right atrium", "Left atrium", mixUps))
        assertNull(mixUpFeedback("Right atrium", "Aorta", mixUps))
        assertNull(mixUpFeedback("Right atrium", "Right atrium", mixUps))
        assertNull(mixUpFeedback("Right atrium", null, mixUps))
    }
}
