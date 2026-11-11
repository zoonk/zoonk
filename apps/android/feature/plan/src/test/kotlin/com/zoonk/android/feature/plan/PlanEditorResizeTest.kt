package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.platform.WindowInfo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.GoalContentCountry
import com.zoonk.api.models.LearningProfileSuggestedInner
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** Adjust plan is a sheet on a phone and a side panel from a medium window; turning the phone moves it, and a country asked about stays asked. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w900dp-h900dp")
class PlanEditorResizeTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val restoration = StateRestorationTester(compose)

    @Test
    fun aCountryAwaitingConfirmationStaysAsTheEditorMovesToTheSidePanel() {
        var width by mutableStateOf(411.dp)
        val summary = learnerSummary()
        val goal =
            summary.goals.first().copy(
                countryDependent = true,
                contentCountry =
                    GoalContentCountry(
                        "BR",
                        "Brazil",
                        editable = true,
                        kind = GoalContentCountry.Kind.CONTENT,
                        lessonVariety = null,
                        rebuild = GoalContentCountry.Rebuild.NONE,
                        source = GoalContentCountry.Source.SAID,
                    ),
                suggested = listOf(LearningProfileSuggestedInner("PT", "Portugal", null, null)),
            )
        val page = PlanPageState(goal, plan(), summary.copy(goals = listOf(goal)))
        restoration.setContent {
            val density = LocalDensity.current
            val window = LocalWindowInfo.current
            val sized =
                object : WindowInfo by window {
                    override val containerSize get() = with(density) { IntSize(width.roundToPx(), 900.dp.roundToPx()) }
                }
            CompositionLocalProvider(LocalWindowInfo provides sized) {
                ZoonkTheme { PlanEditor(page, PlanEdits(), section = null, onTellBuddy = {}, onDismiss = {}) }
            }
        }

        compose.onNodeWithText("Content country").performClick()
        compose.onNodeWithText("Portugal").performClick()
        compose.onNodeWithText("Change the content country?").assertIsDisplayed()

        width = 900.dp
        compose.waitForIdle()
        compose.onNodeWithText("Change the content country?").assertIsDisplayed()

        restoration.emulateSavedInstanceStateRestore()
        compose.waitForIdle()
        compose.onNodeWithText("Change the content country?").assertIsDisplayed()
    }
}
