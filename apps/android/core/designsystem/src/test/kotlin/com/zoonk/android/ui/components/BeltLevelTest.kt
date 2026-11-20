package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BeltLevelTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun theCompactChipNamesTheBeltAndLevel() = readsLevel(false)

    @Test fun theWideChipNamesTheBeltAndLevel() = readsLevel(true)

    private fun readsLevel(inWords: Boolean) {
        compose.setContent { ZoonkTheme { BeltLevel(Belt.Yellow, 2, inWords = inWords) } }
        compose.onNodeWithContentDescription("Yellow belt, Level 2").assertExists()
        compose.onNodeWithContentDescription("Yellow belt 2").assertDoesNotExist()
    }
}
