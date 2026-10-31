package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.challengeContent
import org.junit.Assert.assertEquals
import org.junit.Test

class ChallengeWalkTest {
    private val content = challengeContent()

    @Test
    fun colleaguesTakeTheTeamsNamesInOrderAndAnAiKeepsItsRole() {
        val names = challengeNames(content.team, listOf("Priya"))

        assertEquals(mapOf("c1" to "Priya", "ai" to "Policy assistant"), names)
        assertEquals("Calm the customer Priya called about.", fillChallengeNames(content.mission, names))
        assertEquals("Support lead", challengeNames(content.team, null).getValue("c1"))
    }

    @Test
    fun metersMoveWithEachDecisionAndStayWithinTheirRange() {
        val walk = walkChallenge(content, listOf("ask")) as ChallengeWalk.Ended

        val meter = challengeMeters(content, walk.moves).single()

        assertEquals(100L, meter.value)
        assertEquals(30L, meter.change)
    }

    @Test
    fun theDebriefOffersPracticeForTheSkillMostNotesSaidToImprove() {
        val walk = walkChallenge(content, listOf("quote")) as ChallengeWalk.Ended

        val debrief = challengeDebrief(content, walk.moves)

        assertEquals("listen", debrief.practice?.id)
        assertEquals(listOf("Listen before quoting rules."), debrief.improve.map { it.text })
        assertEquals(false, gradeChallengePath(content, listOf("quote"))?.isCorrect)
    }
}
