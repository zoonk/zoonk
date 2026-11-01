package com.zoonk.android.app

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.ui.scaffold.LocalTabRootBar
import com.zoonk.android.ui.scaffold.TabRootBar
import com.zoonk.android.ui.scaffold.TabRootScaffold
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@OptIn(ExperimentalMaterial3Api::class)
@RunWith(AndroidJUnit4::class)
class TabRootFoldTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    /** An unfolded book foldable: the goal and search end on the page before the fold, as the page's first pane does. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun theGoalAndSearchEndBeforeAnOpenBooksFold() {
        val bar =
            TabRootBar(
                title = { Box(Modifier.fillMaxWidth().testTag("goal")) { Text("A goal with a long name") } },
                actions = {},
                search = { modifier -> Box(modifier.fillMaxWidth().height(56.dp).testTag("search")) },
                searchScroll = { null },
            )
        rule.setContent { CompositionLocalProvider(LocalTabRootBar provides bar) { TabRootScaffold {} } }
        rule.waitForIdle()

        val fold = FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)
        folds.overrideWindowLayoutInfo(TestWindowLayoutInfo(listOf(fold)))
        rule.waitForIdle()

        val goal = rule.onNodeWithTag("goal").getUnclippedBoundsInRoot()
        val search = rule.onNodeWithTag("search").getUnclippedBoundsInRoot()
        assertTrue("the goal ends before the fold: $goal", goal.right <= 426.dp)
        assertTrue("search ends before the fold: $search", search.right <= 426.dp)
    }
}
