package com.zoonk.android.ui.scaffold

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
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
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class PageScaffoldTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    /** A page beside the rail on an unfolded book: back and the title over the page before the fold, the actions over the page after it. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun keepsItsTitleBeforeAnOpenBooksFoldAndItsActionsAfterIt() {
        rule.setContent {
            ZoonkTheme {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopEnd) {
                    PageScaffold(
                        onBack = {},
                        modifier = Modifier.width(772.dp),
                        title = { Box(Modifier.fillMaxWidth().testTag("title")) },
                        actions = { Text("Ask", Modifier.testTag("action")) },
                    ) {}
                }
            }
        }
        rule.waitForIdle()
        val fold = FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)
        folds.overrideWindowLayoutInfo(TestWindowLayoutInfo(listOf(fold)))
        rule.waitForIdle()

        val title = rule.onNodeWithTag("title").getUnclippedBoundsInRoot()
        val action = rule.onNodeWithTag("action").getUnclippedBoundsInRoot()
        assertTrue("the title ends before the fold: $title", title.right <= 426.dp)
        assertTrue("the actions start after the fold: $action", action.left >= 426.dp)
    }
}
