package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w400dp-h800dp")
class SectionHeaderTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    /** A section's title sits on its button's middle, so a header with "See all" doesn't draw its title high. */
    @Test
    fun aTitleCentersOnTheButtonAtItsEnd() {
        compose.setContent {
            ZoonkTheme { SectionHeader("Patterns") { TextButton(onClick = {}) { Text("See all") } } }
        }

        val title = compose.onNodeWithText("Patterns").getUnclippedBoundsInRoot()
        val button = compose.onNodeWithText("See all", useUnmergedTree = true).getUnclippedBoundsInRoot()
        assertEquals(((button.top + button.bottom) / 2).value, ((title.top + title.bottom) / 2).value, 1f)
    }
}
