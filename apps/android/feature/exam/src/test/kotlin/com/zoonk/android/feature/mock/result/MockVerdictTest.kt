package com.zoonk.android.feature.mock.result

import com.zoonk.api.models.MockResultAreasInner
import com.zoonk.api.models.MockResultAreasInnerScore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MockVerdictTest {
    private fun area(
        name: String,
        correct: Double,
        score: Double? = null,
        total: Long = 10,
    ) = MockResultAreasInner(
        correct = correct,
        name = name,
        score = score?.let { MockResultAreasInnerScore(high = it + 60, low = it - 60, score = it) },
        secondsPerQuestion = 120.0,
        targetSecondsPerQuestion = null,
        total = total,
    )

    private fun names(vararg areas: MockResultAreasInner) = verdictAreas(areas.toList())?.let { (best, worst) -> best.name to worst.name }

    @Test
    fun `names the subject with the highest score and the one with the lowest`() {
        assertEquals(
            "English" to "Languages",
            names(area("Languages", 4.0, 480.0), area("English", 8.0, 620.0), area("Humanities", 6.0, 540.0)),
        )
    }

    @Test
    fun `compares by the share of right answers when the exam gives no score per subject`() {
        assertEquals("Ethics" to "Law", names(area("Law", 3.0), area("Ethics", 9.0)))
    }

    @Test
    fun `names no strongest subject when no answer was right, whatever each estimate says`() {
        assertNull(names(area("Languages", 0.0, 320.0), area("Humanities", 0.0, 350.0)))
    }

    @Test
    fun `names no subject to work on when every answer was right`() {
        assertNull(names(area("Languages", 10.0, 800.0), area("Humanities", 10.0, 830.0)))
    }

    @Test
    fun `says nothing with one subject, or when the subjects did the same`() {
        assertNull(names(area("Law", 5.0)))
        assertNull(names(area("Law", 5.0), area("Ethics", 5.0)))
        assertNull(names())
    }
}
