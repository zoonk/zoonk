package com.zoonk.android.feature.session

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.api.models.StudyBlock
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "en")
class PracticeBlockTitleTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val practice =
        decodeFixture<StudyBlock>("study-block").copy(
            kind = StudyBlock.Kind.PRACTICE,
            areas = listOf("Math", "Languages"),
        )

    @Test
    fun extraPracticeKeepsItsTitleAndUsesTheFirstTopic() {
        val blocks =
            listOf(false, true).flatMap { extra ->
                listOf("Calculating discounts", "Comparing fractions").map { lead ->
                    practice.copy(extra = extra, topics = listOf(lead, "Reading graphs"))
                }
            }

        assertTitles(
            blocks,
            listOf(
                "Practice: Calculating discounts",
                "Practice: Comparing fractions",
                "Practice: Calculating discounts",
                "Practice: Comparing fractions",
            ),
        )
    }

    @Test
    fun extraPracticeWithoutTopicsKeepsItsTitleAndUsesTheAreas() {
        assertTitles(
            listOf(practice, practice.copy(extra = true)),
            listOf("Practice: Math and Languages", "Practice: Math and Languages"),
        )
    }

    @Test
    fun extraPracticeWithoutTopicsOrAreasIsMixedPractice() {
        val mixed = practice.copy(areas = emptyList(), topics = emptyList())

        assertTitles(listOf(mixed, mixed.copy(extra = true)), listOf("Mixed practice", "Mixed practice"))
    }

    private fun assertTitles(
        blocks: List<StudyBlock>,
        expected: List<String>,
    ) {
        var titles = emptyList<String>()
        rule.setContent { titles = blocks.map { blockTitle(it.toDayStep()) } }
        rule.waitForIdle()
        assertEquals(expected, titles)
    }
}
