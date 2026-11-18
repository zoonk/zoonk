package com.zoonk.android.ui.scaffold

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.R
import com.zoonk.android.ui.components.PageTitleRow
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
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

        rule.unfoldBook(folds)

        rule.onNodeWithText("Report open").assertIsDisplayed()
    }

    /** A page that centers its column, whatever its own margins, has its way back on that column, as its title is. */
    @Test
    @Config(qualifiers = "w900dp-h900dp")
    fun theWayBackStartsWhereACenteredPagesTitleStarts() {
        rule.setContent {
            ZoonkTheme {
                PageScaffold(onBack = {}) { padding ->
                    Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
                        Column(Modifier.widthIn(max = 400.dp).fillMaxWidth().padding(horizontal = 16.dp)) { PageTitleRow("Settings") }
                    }
                }
            }
        }
        rule.waitForIdle()

        val back = rule.onNodeWithContentDescription(rule.activity.getString(R.string.navigation_back)).getUnclippedBoundsInRoot()
        // The arrow's ink starts 12dp into the button; the title's column starts (900 − 400) / 2 + 16 = 266dp in.
        assertEquals(266f, (back.left + 12.dp).value, 1f)
    }
}
