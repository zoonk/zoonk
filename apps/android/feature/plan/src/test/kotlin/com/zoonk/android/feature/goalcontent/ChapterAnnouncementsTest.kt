package com.zoonk.android.feature.goalcontent

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.plan.SaveFailedText
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ChapterAnnouncementsTest {
    @get:Rule val rule = createComposeRule()

    @Test
    fun practiceWithNothingAvailableAnnouncesItsOutcomePolitely() {
        var outcome by mutableStateOf<PracticeOutcome?>(null)
        rule.setContent {
            ZoonkTheme {
                Column {
                    PracticeChapterRow(PracticeState(running = false, outcome = outcome)) {
                        outcome = PracticeOutcome.NothingToPractice
                    }
                }
            }
        }
        rule.onNodeWithText("Practice this chapter").performClick()
        rule
            .onNodeWithText("Nothing to practice in this chapter yet.")
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite))
    }

    @Test
    fun aFailedPlanSaveAnnouncesAssertively() {
        rule.setContent { ZoonkTheme { SaveFailedText() } }
        rule.onNode(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Assertive)).assertExists()
    }
}
