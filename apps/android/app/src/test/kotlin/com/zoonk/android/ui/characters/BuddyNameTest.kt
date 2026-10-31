package com.zoonk.android.ui.characters

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class BuddyNameTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    @Config(qualifiers = "fr")
    fun aNamedBuddyKeepsItsNameAndAnUnnamedOneIsCalledByItsOwnInTheAppsLanguage() {
        compose.setContent {
            Text(buddyName(BuddyKind.Noodle, customName = "Pipoca"))
            Text(buddyName(BuddyKind.Noodle, customName = ""))
            Text(buddyName(BuddyKind.Beep, customName = null))
        }

        compose.onNodeWithText("Pipoca").assertExists()
        compose.onNodeWithText("Caboche").assertExists()
        compose.onNodeWithText("Bip").assertExists()
    }
}
