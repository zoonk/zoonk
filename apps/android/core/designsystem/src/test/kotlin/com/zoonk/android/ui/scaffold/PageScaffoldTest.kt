package com.zoonk.android.ui.scaffold

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.ui.theme.ZoonkTheme
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

    /** Opening the book caps the title, never moves the actions, so what an action opened stays open. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun keepsWhatAnActionOpenedAsTheBookOpens() {
        rule.setContent {
            ZoonkTheme {
                PageScaffold(
                    onBack = {},
                    actions = {
                        var open by rememberSaveable { mutableStateOf(false) }
                        TextButton(onClick = { open = true }) { Text(if (open) "Report open" else "Report") }
                    },
                ) {}
            }
        }
        rule.onNodeWithText("Report").performClick()

        val fold = FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)
        folds.overrideWindowLayoutInfo(TestWindowLayoutInfo(listOf(fold)))
        rule.waitForIdle()

        rule.onNodeWithText("Report open").assertIsDisplayed()
    }
}
