package com.zoonk.android.feature.activities.music

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(AndroidJUnit4::class)
class PianoKeyboardTest {
    @get:Rule
    val rule = createComposeRule()

    private fun cutOffKeys(names: List<String>): List<String> {
        val shown = rule.onNode(hasContentDescription("Piano keys")).getUnclippedBoundsInRoot()
        return names.filter { name ->
            val key =
                rule
                    .onNode(
                        hasContentDescription(name) and hasAnyAncestor(hasContentDescription("Piano keys")),
                    ).getUnclippedBoundsInRoot()
            key.left < shown.left - SUBPIXEL || key.right > shown.right + SUBPIXEL
        }
    }

    private fun opensInLandscape() {
        rule.onNode(hasContentDescription("Piano keys")).assertWidthIsEqualTo(LANDSCAPE)
        assertEquals(emptyList<String>(), cutOffKeys(G_MAJOR_NAMES))
    }

    @Test
    @Config(qualifiers = "w800dp-h400dp")
    fun aChordOffTheKeyboardsStartStaysInViewWhenTheWindowNarrows() {
        var width by mutableStateOf(LANDSCAPE)
        rule.setContent { GMajorKeyboard(width) }
        opensInLandscape()

        width = PORTRAIT

        rule.waitForIdle()
        assertEquals(emptyList<String>(), cutOffKeys(G_MAJOR_NAMES))
    }

    @Test
    @Config(qualifiers = "w360dp-h800dp")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun aBlackKeysMarkStaysRoundWithinItsKeyAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        val octave = mapOf(60 to NoteMarkKind.Kept, 63 to NoteMarkKind.Kept, 70 to NoteMarkKind.New, 71 to NoteMarkKind.Kept)
        rule.setContent {
            ZoonkTheme {
                PianoKeyboard(
                    label = "Piano keys",
                    marks = octave,
                    nameOf = { NAMES[it % MusicNotes.OCTAVE] },
                    spokenNameOf = { NAMES[it % MusicNotes.OCTAVE] },
                    isPressed = { it in octave },
                    onPress = {},
                )
            }
        }

        listOf("E flat", "B flat").forEach { name ->
            val inKey = hasAnyAncestor(hasContentDescription(name) and hasAnyAncestor(hasContentDescription("Piano keys")))
            val drawn = rule.onNode(inKey and IS_DRAWN_KEY, useUnmergedTree = true).getBoundsInRoot()
            val mark = rule.onNode(inKey and IS_MARK, useUnmergedTree = true).getBoundsInRoot()
            assertEquals("$name's mark is squeezed", (mark.bottom - mark.top).value, (mark.right - mark.left).value, SUBPIXEL.value)
            assertTrue("$name's mark leaves its key", mark.left >= drawn.left - SUBPIXEL && mark.right <= drawn.right + SUBPIXEL)
        }
    }

    /** Turning or unfolding the phone recreates the activity, whose saved state is from the old width. */
    @Test
    @Config(qualifiers = "w800dp-h400dp")
    fun aChordOffTheKeyboardsStartStaysInViewWhenThePhoneTurnsUpright() {
        val restoration = StateRestorationTester(rule)
        var width = LANDSCAPE
        restoration.setContent { GMajorKeyboard(width) }
        opensInLandscape()

        width = PORTRAIT
        restoration.emulateSavedInstanceStateRestore()

        assertEquals(emptyList<String>(), cutOffKeys(G_MAJOR_NAMES))
    }
}

@Composable
private fun GMajorKeyboard(width: Dp) {
    ZoonkTheme {
        Box(Modifier.width(width)) {
            PianoKeyboard(
                label = "Piano keys",
                marks = G_MAJOR,
                nameOf = { NAMES[it % MusicNotes.OCTAVE] },
                spokenNameOf = { NAMES[it % MusicNotes.OCTAVE] },
                isPressed = { it in G_MAJOR },
                onPress = {},
            )
        }
    }
}

private val G_MAJOR = mapOf(62 to NoteMarkKind.Kept, 67 to NoteMarkKind.Kept, 71 to NoteMarkKind.Kept)
private val G_MAJOR_NAMES = listOf("D", "G", "B")
private val LANDSCAPE = 700.dp
private val PORTRAIT = 311.dp

private val NAMES = listOf("C", "C sharp", "D", "E flat", "E", "F", "F sharp", "G", "A flat", "A", "B flat", "B")
private val SUBPIXEL = 1.dp

private val IS_DRAWN_KEY = SemanticsMatcher.keyIsDefined(SemanticsProperties.Shape)

/** A key's note mark is drawn, not read: TalkBack hears the key instead. */
private val IS_MARK = SemanticsMatcher("is a key's note mark") { it.config.isClearingSemantics }
