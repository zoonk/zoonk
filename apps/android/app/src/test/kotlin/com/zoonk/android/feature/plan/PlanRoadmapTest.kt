package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w600dp-h900dp")
class PlanRoadmapTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private fun show() {
        val summary = learnerSummary()
        val page = PlanPageState(summary.goals.first(), learnPlan(), summary)
        compose.setContent { ZoonkTheme { PlanRoadmap(page, PlanLinks(rememberAppNavigator(), page)) } }
    }

    @Test
    fun aPhaseNameTooLongForItsBandWrapsInsteadOfBeingCut() {
        RuntimeEnvironment.setFontScale(2f)
        show()

        val layouts = mutableListOf<TextLayoutResult>()
        compose
            .onNodeWithText("Python basics", substring = true, useUnmergedTree = true)
            .performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }

        assertFalse(layouts.single().hasVisualOverflow)
    }

    @Test
    fun eachPhaseSaysWhenAsTheAxisShowsIt() {
        show()

        compose.onNode(hasContentDescription("Python basics", substring = true)).assertContentDescriptionEquals("Python basics, done")
        compose
            .onNode(hasContentDescription("Data structures", substring = true))
            .assertContentDescriptionEquals("Data structures, you are here. Today")
        compose.onNode(hasContentDescription("Web apps", substring = true)).assertContentDescriptionEquals("Web apps. From Nov 11")
    }
}
