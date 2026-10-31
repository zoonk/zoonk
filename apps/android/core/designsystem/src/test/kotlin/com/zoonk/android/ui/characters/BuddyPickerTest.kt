package com.zoonk.android.ui.characters

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class BuddyPickerTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    @Test
    fun aPickedBuddyIsSelectedAndAnEmptyNameKeepsItsOwn() {
        var kind by mutableStateOf(BuddyKind.Zu)
        var name by mutableStateOf("")
        rule.setContent {
            ZoonkTheme { BuddyPicker(kind = kind, name = name, onSelect = { kind = it }, onNameChange = { name = it }) }
        }

        rule.onNodeWithText("Otto").performClick()
        rule.onNodeWithText("Know-it-all octopus").assertIsDisplayed()
        assertEquals(BuddyKind.Otto, kind)
        rule.onNode(hasText("Otto", substring = false) and !hasSetTextAction(), useUnmergedTree = false).assertIsSelected()

        rule.onNode(hasSetTextAction()).performTextInput("Octavia")
        assertEquals("Octavia", name)
    }
}
