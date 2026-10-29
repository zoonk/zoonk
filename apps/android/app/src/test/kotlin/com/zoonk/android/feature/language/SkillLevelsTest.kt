package com.zoonk.android.feature.language

import com.zoonk.api.models.LanguageSkillLevel
import com.zoonk.api.models.LanguageSkillLevel.Skill
import com.zoonk.api.models.LanguageSkillLevel.Trend
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SkillLevelsTest {
    @Test
    fun aLevelIsHalfStepsFromA1() {
        assertEquals(0.0, parseCefrScore("A1")!!, DELTA)
        assertEquals(2.0, parseCefrScore("B1")!!, DELTA)
        assertEquals(2.5, parseCefrScore(" b1+ ")!!, DELTA)
        assertEquals(5.0, parseCefrScore("C2+")!!, DELTA)
    }

    @Test
    fun anythingElseIsNoLevel() {
        assertNull(parseCefrScore("B3"))
        assertNull(parseCefrScore(""))
    }

    @Test
    fun risesListEverySkillThatRoseTheBiggestRiseFirst() {
        val levels =
            listOf(
                level(Skill.READING, 2.0, "B1"),
                level(Skill.SPEAKING, 1.5, "A2"),
                level(Skill.LISTENING, 2.0, "A2"),
                level(Skill.WRITING, 1.5, "A2"),
            )

        assertEquals(listOf(Skill.LISTENING, Skill.SPEAKING, Skill.WRITING), listRises(levels).map { it.skill })
    }

    @Test
    fun nothingRoseWhenNoSkillWentUp() {
        assertEquals(emptyList<LanguageSkillLevel>(), listRises(listOf(level(Skill.READING, 1.0, "A2"), level(Skill.WRITING, 0.5, "A2"))))
    }

    private fun level(
        skill: Skill,
        score: Double,
        startLabel: String,
    ) = LanguageSkillLevel(
        label = startLabel,
        score = score,
        skill = skill,
        startLabel = startLabel,
        trend = if (score > parseCefrScore(startLabel)!!) Trend.UP else Trend.SAME,
    )

    private companion object {
        const val DELTA = 1e-9
    }
}
