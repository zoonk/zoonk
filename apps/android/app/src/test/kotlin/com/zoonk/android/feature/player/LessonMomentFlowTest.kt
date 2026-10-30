package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.ceremonies.MomentCeremony
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LessonMomentFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private val ceremony: MomentCeremony = { milestone, onClose ->
        Column {
            Text("New ${milestone.kind.value}")
            Button(onClick = onClose) { Text("Close ceremony") }
        }
    }

    @Test
    fun aMilestoneCeremonyShowsBeforeTheLessonsEndAndItsDayMoment() {
        harness.play(listOf(summaryStep("end")), ceremony = ceremony) { completion = COMPLETION_WITH_GLASSES }

        harness.tap("Continue")
        rule.onNodeWithText("New glasses").assertIsDisplayed()
        rule.onNodeWithText("Lesson complete").assertDoesNotExist()

        harness.tap("Close ceremony")
        rule.onNodeWithText("Lesson complete").assertIsDisplayed()
        rule.onNodeWithText("Energy at", substring = true).performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("New glasses").assertDoesNotExist()
    }
}

private val COMPLETION_WITH_GLASSES =
    """
    {"ceremony":{"beltStartBrainPower":null,"earnedAt":"2026-10-29T12:00:00Z","id":"00000000-0000-4000-8000-0000000000c1",
     "key":"round","kind":"glasses","shownAt":null},
     "reached":{"energy":60,"level":null},"brainPower":30,"correctCount":2,"energyDelta":0.5,
     "incorrectCount":0,"isFirstCompletion":true,"nextReviewAt":"2026-10-31T09:00:00Z","seconds":120,"studyBlock":null,
     "totalBrainPower":130}
    """.trimIndent()
