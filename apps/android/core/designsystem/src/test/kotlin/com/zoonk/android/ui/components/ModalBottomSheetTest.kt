package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
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

@OptIn(ExperimentalMaterial3Api::class)
@RunWith(AndroidJUnit4::class)
class ModalBottomSheetTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private fun show() {
        rule.setContent {
            ZoonkTheme {
                ModalBottomSheet(onDismissRequest = {}) {
                    Box(Modifier.fillMaxWidth().height(200.dp).testTag("sheet")) { Text("Ask about this screen") }
                }
            }
        }
        rule.waitForIdle()
    }

    /** As the open iPhone Duo moves its sheets: on the page after the fold, never centered across it. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun anOpenBooksSheetSitsOnThePageAfterTheFold() {
        show()
        val fold =
            FoldingFeature(rule.activity, state = FoldingFeature.State.HALF_OPENED, orientation = FoldingFeature.Orientation.VERTICAL)
        folds.overrideWindowLayoutInfo(TestWindowLayoutInfo(listOf(fold)))
        rule.waitForIdle()

        val sheet = rule.onNodeWithTag("sheet").getUnclippedBoundsInRoot()
        assertTrue("the sheet starts after the fold: $sheet", sheet.left >= 426.dp)
        assertTrue("the sheet ends at the window's edge: $sheet", sheet.right <= 852.dp)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun aPhonesSheetSpansItsWidth() {
        show()

        val sheet = rule.onNodeWithTag("sheet").getUnclippedBoundsInRoot()
        assertTrue("the sheet spans the phone: $sheet", sheet.left <= 0.5.dp && sheet.right >= 410.5.dp)
    }
}
