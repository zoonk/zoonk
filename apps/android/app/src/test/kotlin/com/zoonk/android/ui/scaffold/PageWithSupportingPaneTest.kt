package com.zoonk.android.ui.scaffold

import androidx.compose.material3.Text
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
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

    private fun show() {
        rule.setContent {
            ZoonkTheme {
                PageWithSupportingPane(supportingPane = { Text("Aside beside") }) { beside ->
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

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun aWideWindowShowsTheAsideBeside() {
        show()

        rule.onNodeWithText("Page").assertIsDisplayed()
        rule.onNodeWithText("Aside beside").assertIsDisplayed()
    }
}
