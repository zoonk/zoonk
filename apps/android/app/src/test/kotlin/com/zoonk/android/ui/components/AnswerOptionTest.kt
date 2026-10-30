package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

private const val SHORT = "No núcleo"
private const val WRAPPING = "Os elétrons ocupam quase todo o espaço do átomo"
private const val LONG = "No núcleo, um caroço minúsculo no centro"

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h900dp-xhdpi")
class AnswerOptionTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private fun showChecked(words: String) {
        compose.setContent {
            ZoonkTheme(darkTheme = false) {
                Surface {
                    AnswerOption(marker = 1, picked = true, result = AnswerResult.Wrong, onClick = {}, modifier = Modifier.padding(16.dp)) {
                        Text(words, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        }
    }

    private fun tagTop() = compose.onNodeWithText("Your answer", useUnmergedTree = true).getUnclippedBoundsInRoot().top

    private fun wordsBottom(words: String) = compose.onNodeWithText(words, useUnmergedTree = true).getUnclippedBoundsInRoot().bottom

    @Test
    fun aShortOptionKeepsItsTagBesideItsWords() {
        showChecked(SHORT)

        assertTrue("The tag sits under words that fit beside it: ${tagTop()} >= ${wordsBottom(SHORT)}", tagTop() < wordsBottom(SHORT))
    }

    @Test
    fun aWrappingOptionKeepsItsTagBesideWhenThatIsNoTaller() {
        showChecked(WRAPPING)

        assertTrue("The tag sits under words that wrap as much beside it: ${tagTop()} >= ${wordsBottom(WRAPPING)}", tagTop() < wordsBottom(WRAPPING))
    }

    @Test
    fun aLargeFontMovesTheTagUnderTheWordsWhenThatKeepsTheOptionShorter() {
        RuntimeEnvironment.setFontScale(2f)
        showChecked(LONG)

        assertTrue("Beside the tag, the words squeeze into a narrow column: ${tagTop()} < ${wordsBottom(LONG)}", tagTop() >= wordsBottom(LONG))
    }
}
