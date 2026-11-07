package com.zoonk.android.ui.scaffold

import org.junit.Assert.assertSame
import org.junit.Test

class TitleFocusTest {
    /** A page recreated scrolled past its heading keeps its place: TalkBack starts on the bar's title, not the heading above it. */
    @Test
    fun scrolledPastItsHeadingStartsOnTheBarTitle() {
        val focus = laidOut(headingBottom = 40f)

        assertSame(focus.bar, focus.shownTitle())
    }

    @Test
    fun headingInViewStartsOnTheHeading() {
        val focus = laidOut(headingBottom = 160f)

        assertSame(focus.heading, focus.shownTitle())
    }

    private fun laidOut(headingBottom: Float) =
        TitleFocus().apply {
            bar.shown = true
            heading.shown = true
            barBottom = 100f
            this.headingBottom = headingBottom
        }
}
