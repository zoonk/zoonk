package com.zoonk.android.feature.placementtest

import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.TestContext
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import kotlin.math.abs

/** A topic of any length keeps the test's top one line high and centered, so the question under it never moves. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class TestTitleTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    @Test
    fun aLongTopicStaysOneCenteredLine() {
        val topic = "Constitutional limits on the taxing power of states and municipalities"
        val sitting = asking(TestContext(GOAL_ID, TestContext.Kind.Course, TestContext.Surface.Plan), topic, 2, 8)
        rule.setContent { ZoonkTheme { TaskScaffold(onClose = {}, title = { TestTitle(sitting) }) {} } }

        val title = rule.onNodeWithText(topic).fetchSemanticsNode()
        val layouts = mutableListOf<TextLayoutResult>()
        title.config[SemanticsActions.GetTextLayoutResult].action?.invoke(layouts)
        assertEquals(1, layouts.single().lineCount)
        assertTrue(layouts.single().hasVisualOverflow)

        val page = rule.onRoot().fetchSemanticsNode().boundsInRoot
        val tolerance = with(rule.density) { 1.dp.toPx() }
        assertTrue(abs(title.boundsInRoot.center.x - page.center.x) <= tolerance)
    }
}
