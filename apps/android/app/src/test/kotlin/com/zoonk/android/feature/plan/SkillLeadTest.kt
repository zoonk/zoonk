package com.zoonk.android.feature.plan

import com.zoonk.api.models.LanguageSkillLevel
import com.zoonk.api.models.LanguageSkillLevel.Skill
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SkillLeadTest {
    @Test
    fun theHighestSkillLeadsWhenItIsAhead() {
        assertEquals(
            SkillLead.Leads(Skill.LISTENING),
            skillLead(levels(Skill.READING to 1.5, Skill.LISTENING to 2.5, Skill.WRITING to 1.0)),
        )
    }

    @Test
    fun noSkillLeadsWhenTheHighestAreTied() {
        assertNull(skillLead(levels(Skill.READING to 2.5, Skill.LISTENING to 2.5, Skill.WRITING to 1.0)))
    }

    @Test
    fun skillsAtOneLevelAreEven() {
        assertEquals(SkillLead.Even, skillLead(levels(Skill.READING to 2.0, Skill.LISTENING to 2.0)))
    }

    @Test
    fun oneSkillMeasuredSaysNothing() {
        assertNull(skillLead(levels(Skill.READING to 2.0)))
    }

    @Test
    fun noLevelsYetSayNothing() {
        assertNull(skillLead(emptyList()))
    }

    private fun levels(vararg scores: Pair<Skill, Double>) =
        scores.map { (skill, score) -> LanguageSkillLevel("B1", score, skill, "A2", LanguageSkillLevel.Trend.SAME) }
}
