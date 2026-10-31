package com.zoonk.android.feature.activities

import org.junit.Assert.assertEquals
import org.junit.Test

class ActivityFixturesTest {
    @Test
    fun everyFixtureMainPlaysDecodesWithItsExpectedEndState() {
        val decoded = ActivityFixtures.names.filter { ActivityFixtures.step(it).id == it && ActivityFixtures.expected(it) != null }

        assertEquals(ActivityFixtures.names, decoded.toSet())
        assertEquals(35, decoded.map { it.substringBefore('.') }.toSet().size)
    }
}
