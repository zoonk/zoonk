package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class PageWithSupportingPaneTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private fun show(width: Dp = Dp.Unspecified) {
        rule.setContent {
            ZoonkTheme {
                PageWithSupportingPane(supportingPane = { Text("Aside beside") }, modifier = Modifier.width(width)) { beside ->
                    Text(if (beside) "Page" else "Page with its aside below")
                }
            }
        }
    }

    @Test
    @Config(qualifiers = "w448dp-h997dp")
    fun aTallPhoneShowsOnePageWithItsAsideInIt() {
        show()

        rule.onNodeWithText("Page with its aside below").assertIsDisplayed()
        rule.onNodeWithText("Aside beside").assertDoesNotExist()
    }

    /** An unfolded foldable is an expanded window, but the drawer beside the page leaves it a phone's width. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun aPageNarrowerThanItsWindowShowsItsAsideInIt() {
        show(width = 492.dp)

        rule.onNodeWithText("Page with its aside below").assertIsDisplayed()
        rule.onNodeWithText("Aside beside").assertDoesNotExist()
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun aWideWindowShowsTheAsideBeside() {
        show()

        rule.onNodeWithText("Page").assertIsDisplayed()
        rule.onNodeWithText("Aside beside").assertIsDisplayed()
    }
}
