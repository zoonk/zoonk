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
            topics = listOf("Calculating discounts", "Reading graphs"),
        )

    @Test
    fun aPracticeIsNeverNamedAfterOneOfItsTopics() {
        assertTitles(listOf(practice, practice.copy(extra = true)), listOf("Practice", "Practice"))
    }

    @Test
    fun aDayWithSeveralPracticesNumbersThem() {
        assertTitles(
            listOf(practice.copy(practiceNumber = 1), practice.copy(practiceNumber = 2, extra = true)),
            listOf("Practice 1", "Practice 2"),
        )
    }

    @Test
    fun aSubjectsPracticeIsNamedAfterTheSubject() {
        assertTitles(listOf(practice.copy(title = "Percentages", extra = true)), listOf("Practice: Percentages"))
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
