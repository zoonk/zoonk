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
@Config(qualifiers = "de")
class PracticeBlockTitleGermanTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aNumberedPracticeTakesTheWebsWording() {
        val practice =
            decodeFixture<StudyBlock>("study-block").copy(
                kind = StudyBlock.Kind.PRACTICE,
                topics = listOf("Rabatte berechnen"),
            )
        var titles = emptyList<String>()

        rule.setContent { titles = listOf(practice, practice.copy(practiceNumber = 2)).map { blockTitle(it.toDayStep()) } }
        rule.waitForIdle()

        assertEquals(listOf("Übung", "Übung 2"), titles)
    }
}
