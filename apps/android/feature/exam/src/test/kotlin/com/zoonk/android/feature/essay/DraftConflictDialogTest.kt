package com.zoonk.android.feature.essay

import androidx.activity.ComponentActivity
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DraftConflictDialogTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun enterKeepsTheDraftAndReplacingItRequiresChoosingTheOtherButton() {
        val picks = mutableListOf<String>()

        rule.setContent {
            ZoonkTheme { DraftConflictDialog(onKeepThis = { picks.add("keep") }, onUseOther = { picks.add("replace") }) }
        }

        rule.onNodeWithText("Keep this one").assertIsFocused().performKeyInput { pressKey(Key.Enter) }
        rule.runOnIdle { assertEquals(listOf("keep"), picks) }

        rule.onNodeWithText("Use the other").performClick()
        rule.runOnIdle { assertEquals(listOf("keep", "replace"), picks) }
    }
}
