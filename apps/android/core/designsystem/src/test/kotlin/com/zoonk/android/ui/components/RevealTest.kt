package com.zoonk.android.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Main's `getReveal` cases: a verdict comes into sight whole, and what scrolls away at the top leaves whole. */
class RevealTest {
    private val visible = RevealSpan(100f, 700f)
    private val room = 2000f

    private fun reveal(
        feedback: RevealSpan,
        vararg kept: RevealSpan,
        room: Float = this.room,
        visible: RevealSpan = this.visible,
    ) = reveal(feedback, kept.toList(), visible, room, margin = 16f).delta

    @Test
    fun staysPutWhenTheFeedbackIsAlreadyInSight() {
        assertEquals(0f, reveal(RevealSpan(500f, 600f), RevealSpan(116f, 144f)))
    }

    @Test
    fun showsTheWholeFeedbackAndTheTitleTooWhenItHasTheRoom() {
        assertEquals(76f, reveal(RevealSpan(660f, 760f), RevealSpan(216f, 244f)))
    }

    @Test
    fun letsTheTitleScrollAwayWhenTheWholeFeedbackNeedsItsRoom() {
        assertEquals(216f, reveal(RevealSpan(700f, 900f), RevealSpan(156f, 184f)))
    }

    @Test
    fun scrollsATitleOutWholeWhenShowingTheFeedbackWouldCutIt() {
        val title = RevealSpan(116f, 172f)
        val delta = reveal(RevealSpan(600f, 740f), title)

        assertEquals(72f, delta)
        assertEquals(visible.top, title.bottom - delta)
    }

    @Test
    fun scrollsACardOutWholeAndKeepsTheOneUnderIt() {
        val first = RevealSpan(116f, 138f)
        val next = RevealSpan(150f, 178f)
        val delta = reveal(RevealSpan(600f, 714f), first, next)

        assertEquals(38f, delta)
        assertTrue(first.bottom - delta <= visible.top)
        assertTrue(next.top - delta >= visible.top)
    }

    @Test
    fun keepsATitleWholeWhenThePageCantScrollItOutAndTheFeedbackStillShowsWhole() {
        val feedback = RevealSpan(600f, 710f)
        val title = RevealSpan(116f, 172f)
        val delta = reveal(feedback, title, room = 30f)

        assertTrue(title.top - delta >= visible.top)
        assertTrue(feedback.bottom - delta <= visible.bottom)
    }

    @Test
    fun takesACardOutWholeWithTheRoomItLacksWhenKeepingItWouldCutTheFeedback() {
        val area = RevealSpan(69f, 767f)
        val feedback = RevealSpan(689f, 801f)
        val card = RevealSpan(85f, 139f)
        val (delta, extraRoom) = reveal(feedback, listOf(card), area, room = 58f, margin = 16f)

        assertTrue(card.bottom - delta <= area.top)
        assertTrue(feedback.bottom - delta <= area.bottom)
        assertEquals(delta - 58f, extraRoom)
    }

    @Test
    fun neverScrollsPastTheTopOfAFeedbackTallerThanThePage() {
        val feedback = RevealSpan(800f, 1390f)
        val delta = reveal(feedback, RevealSpan(116f, 144f))

        assertTrue(feedback.bottom - delta <= visible.bottom)
        assertTrue(feedback.top - delta >= visible.top)
    }
}
