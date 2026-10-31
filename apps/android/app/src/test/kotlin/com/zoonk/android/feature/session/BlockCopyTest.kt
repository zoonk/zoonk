package com.zoonk.android.feature.session

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyCheckpoint
import com.zoonk.api.models.StudyCheckpointOneOf1
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BlockCopyTest {
    @get:Rule
    val compose = createComposeRule()

    private fun challenge(
        questions: Long,
        mock: Boolean = false,
    ) = step(1, kind = StudyBlock.Kind.CHECKPOINT, lessonId = null).copy(
        title = "Ordering food",
        questions = questions,
        checkpoint =
            StudyCheckpoint.StudyCheckpointOneOf1Value(
                StudyCheckpointOneOf1(
                    StudyCheckpointOneOf1.Kind.BOSS,
                    phase = 2,
                    rematch = false,
                    mock = mock,
                    passMark = 70,
                    timeLimitMinutes = null,
                ),
            ),
    )

    private val practice =
        step(1, kind = StudyBlock.Kind.PRACTICE, lessonId = null).copy(
            title = null,
            questions = 10,
            areas = listOf("Math", "Languages"),
            topics = listOf("Functions", "Percentages") + (1..8).map { "Topic $it" },
        )

    private fun detail(step: DayStep): String? {
        var detail: String? = null
        compose.setContent { detail = blockDetail(step) }
        compose.waitForIdle()
        return detail
    }

    @Test
    fun aLanguageUnitsChallengeIsALiveCallNotZeroQuestions() {
        assertEquals("Ordering food\u00A0· a live call", detail(challenge(questions = 0)))
    }

    @Test
    fun aPhaseChallengeCountsItsQuestions() {
        assertEquals("Ordering food\u00A0· 8 questions, no hints", detail(challenge(questions = 8)))
    }

    @Test
    fun aPracticeBlockIsNamedAfterTheAreasMostOfItAsksAbout() {
        var titles = emptyList<String>()
        val steps = listOf(practice, practice.copy(extra = true), practice.copy(areas = emptyList()))

        compose.setContent { titles = steps.map { blockTitle(it) } }
        compose.waitForIdle()

        assertEquals(listOf("Practice: Math and Languages", "Bonus practice: Math and Languages", "Mixed practice"), titles)
    }

    @Test
    fun aPracticeBlocksDetailNamesItsFirstTopics() {
        assertEquals("10 questions\u00A0· Functions, Percentages and 8 more topics", detail(practice))
    }
}
