package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.WrittenPractice
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** The choice of when to practice the written tests, as the Plan and a written test's page both show it. */
@RunWith(AndroidJUnit4::class)
class WrittenCadenceChoiceTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val asked = mutableListOf<WrittenPractice.Cadence>()

    private fun show(
        practice: WrittenPractice = practice(),
        tapped: WrittenPractice.Cadence? = null,
        failed: Boolean = false,
    ) {
        rule.setContent {
            ZoonkTheme {
                WrittenCadenceChoice(practice, asked = tapped, pending = tapped != null, failed = failed, onChange = { asked += it })
            }
        }
    }

    @Test
    fun aTapAsksForThatCadenceAndTheSavedOneAsksNothing() {
        show()

        rule.onNodeWithText("Every week").assertIsSelected().performClick()
        rule.onNodeWithText("Every other week").performClick()

        assertEquals(listOf(WrittenPractice.Cadence.BIWEEKLY), asked)
    }

    @Test
    fun whileItSavesTheTappedCadenceShowsAndTheChoiceWaits() {
        show(tapped = WrittenPractice.Cadence.BIWEEKLY)

        rule.onNodeWithText("Every other week").assertIsSelected().assertIsNotEnabled()
        rule.onNodeWithText("The same practice in alternate weeks: less spread out, more at a time.").assertIsDisplayed()
    }

    @Test
    fun theFinalWeeksAreOfferedOnlyWhenThePlanHasThem() {
        show(practice(finalWeeksFrom = null))

        rule.onNodeWithText("When to practice the essay").assertIsDisplayed()
        rule.onNodeWithText("Only the final weeks").assertDoesNotExist()
    }

    @Test
    fun aChangeThatDidntSaveSaysSo() {
        show(failed = true)

        rule.onNodeWithText("That didn't save. Try again.").assertIsDisplayed()
    }

    private fun practice(finalWeeksFrom: String? = "2027-09-01"): WrittenPractice =
        ApiJson.decodeFromString(
            """{"cadence":"weekly","finalWeeksFrom":${finalWeeksFrom?.let { "\"$it\"" } ?: "null"},"parts":["the essay"]}""",
        )
}
