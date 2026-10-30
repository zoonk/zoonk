package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Plan
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.time.LocalDate

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w600dp-h900dp")
class PlanRoadmapTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val bands get() = compose.onAllNodes(hasClickAction())

    private fun show(plan: Plan = learnPlan()) {
        val summary = learnerSummary()
        val page = PlanPageState(summary.goals.first(), plan, summary)
        compose.setContent { ZoonkTheme { PlanRoadmap(page, PlanLinks(rememberAppNavigator(), page)) } }
    }

    private fun assertNamesFitInBandsAsTall() {
        val nodes = bands.fetchSemanticsNodes()
        assertEquals(1, nodes.map { it.size.height }.distinct().size)
        nodes.indices.forEach { index ->
            val layouts = mutableListOf<TextLayoutResult>()
            bands[index].performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
            assertFalse(layouts.single().hasVisualOverflow)
        }
    }

    @Test
    fun atTwiceTheTextSizeNamesWrapInBandsAsTall() {
        RuntimeEnvironment.setFontScale(2f)
        show()

        assertNamesFitInBandsAsTall()
    }

    @Test
    @Config(qualifiers = "w600dp-h900dp-420dpi")
    fun atAFractionalDensityAWrappedNameStillFits() {
        RuntimeEnvironment.setFontScale(2f)
        show()

        assertNamesFitInBandsAsTall()
    }

    @Test
    @Config(qualifiers = "w1000dp-h900dp")
    fun aOneLineBandKeepsMainsHeight() {
        show()

        val height = with(compose.density) { 32.dp.roundToPx() }
        assertEquals(listOf(height), bands.fetchSemanticsNodes().map { it.size.height }.distinct())
    }

    @Test
    @Config(qualifiers = "w580dp-h900dp")
    fun aRowTooNarrowForEveryPhasesBandShowsTheMeterInstead() {
        val start = LocalDate.parse("2026-10-26")
        val phases =
            (0 until 8).joinToString(",") { index ->
                val state = if (index == 0) "current" else "upcoming"
                val from = start.plusWeeks(index.toLong())
                phase(index, "Phase ${index + 1}", state, "$from", "${from.plusDays(6)}", 0, 4)
            }
        show(plan(""""phases":[$phases],"currentPhase":0"""))

        bands.assertCountEquals(0)
        compose.onAllNodesWithText("Phase 8").assertCountEquals(0)
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
