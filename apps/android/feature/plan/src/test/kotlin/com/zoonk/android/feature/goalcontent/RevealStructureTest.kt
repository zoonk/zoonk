package com.zoonk.android.feature.goalcontent

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.onboarding.chapterOf
import com.zoonk.android.feature.onboarding.phaseOf
import com.zoonk.android.feature.onboarding.planOf
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.time.LocalDate

@RunWith(AndroidJUnit4::class)
class RevealStructureTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun showsTheMilestoneWhileTheOnlyPhasesChaptersAreWriting() {
        val today = LocalDate.now()
        val chapters = "[${chapterOf("Variables")}]"
        val plan = planOf(phases = listOf(phaseOf(0, "learn", "current", today, today.plusDays(30), chapters)))
        val milestone = "Write small Python programs"
        val phase = plan.phases.single()
        val writingPhase = phase.copy(milestone = milestone, chapters = phase.chapters.map { it.copy(writing = true) })

        compose.setContent {
            ZoonkTheme { RevealStructure(plan.copy(phases = listOf(writingPhase)), syllabus = null) }
        }

        compose.onNodeWithText(milestone).assertIsDisplayed()
        compose.onNodeWithText("Variables").assertDoesNotExist()
    }
}
