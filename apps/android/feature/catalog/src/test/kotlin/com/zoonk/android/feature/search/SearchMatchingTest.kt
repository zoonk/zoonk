package com.zoonk.android.feature.search

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SearchMatchingTest {
    @Test
    fun matchingIgnoresAccentsAndCase() {
        assertTrue(matchesSearch("ESTATISTICA", "Estatística"))
        assertFalse(matchesSearch("ば", "は"))
        assertTrue(matchesSearch("  ", "anything"))
        assertFalse(matchesSearch("plan", "Today"))
    }
}
