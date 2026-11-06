package com.zoonk.android.feature.player.steps

import org.junit.Assert.assertEquals
import org.junit.Test

class IdeaSlotsTest {
    @Test
    fun placesIdeasAsMainDoesTwoAboveTheCenterAndALoneLastOneInTheMiddle() {
        assertEquals(listOf(IdeaSlot(-1, 1), IdeaSlot(1, 1)), ideaSlots(2))
        assertEquals(listOf(IdeaSlot(-1, -1), IdeaSlot(1, -1), IdeaSlot(0, 1)), ideaSlots(3))
        assertEquals(
            listOf(IdeaSlot(-1, -1), IdeaSlot(1, -1), IdeaSlot(-1, 1), IdeaSlot(1, 1), IdeaSlot(0, 2)),
            ideaSlots(5),
        )
        assertEquals(-1..2, slotRows(ideaSlots(5)))
        assertEquals(0..1, slotRows(ideaSlots(2)))
    }

    @Test
    fun numbersTheSlotsInReadingOrderSoTalkBackFollowsTheNumbers() {
        (1..8).forEach { count ->
            val slots = ideaSlots(count)
            assertEquals(slots.sortedWith(compareBy({ it.row }, { it.column })), slots)
        }
    }
}
