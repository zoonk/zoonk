package com.zoonk.android.ui.scaffold

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusManager
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class BottomBarTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    /** A note draws over the page just above the bar, which never grows; the bar says how much room the page keeps clear for it. */
    @Test
    fun aNoteLeavesTheBarsHeightAndTellsThePageItsRoom() {
        var withNote by mutableStateOf(false)
        val room = BarNoteRoom()
        compose.setContent {
            ZoonkTheme {
                Column(Modifier.fillMaxSize()) {
                    Spacer(Modifier.weight(1f))
                    BottomBar(
                        Modifier.testTag(BAR),
                        note = if (withNote) ({ Text("That didn't save", Modifier.height(64.dp)) }) else null,
                        noteRoom = room,
                    ) { Button(onClick = {}) { Text("Save") } }
                }
            }
        }
        val barOnly = compose.onNodeWithTag(BAR).getUnclippedBoundsInRoot().let { it.bottom - it.top }

        withNote = true
        compose.waitForIdle()

        val withIt = compose.onNodeWithTag(BAR).getUnclippedBoundsInRoot().let { it.bottom - it.top }
        assertEquals("the bar keeps its height", barOnly.value, withIt.value, 1f)
        assertEquals("the note's 64 and its 16 of padding", 80f, room.height.value, 1f)
    }

    /** Tab reaches the note's action before the bar's buttons under it, as the web's order does. */
    @Test
    fun focusReachesTheNotesActionBeforeTheBarsButtons() {
        lateinit var focus: FocusManager
        compose.setContent {
            ZoonkTheme {
                focus = LocalFocusManager.current
                BottomBar(note = { Button(onClick = {}) { Text("Subscribe") } }) { Button(onClick = {}) { Text("Start") } }
            }
        }

        compose.runOnIdle { focus.moveFocus(FocusDirection.Next) }
        compose.onNodeWithText("Subscribe").assertIsFocused()
        compose.runOnIdle { focus.moveFocus(FocusDirection.Next) }
        compose.onNodeWithText("Start").assertIsFocused()
    }

    /** In a short window, a note taller than the room between the page's top bar and the bar scrolls within that room. */
    @Config(qualifiers = "w640dp-h320dp-land", fontScale = 2f)
    @Test
    fun aNoteTallerThanItsRoomStartsBelowThePagesTopAndScrolls() {
        compose.setContent {
            ZoonkTheme {
                PageScaffold(onBack = {}, title = { Text("Learn piano") }) { padding ->
                    Column(Modifier.fillMaxSize().padding(padding)) {
                        Box(Modifier.weight(1f).fillMaxWidth().testTag(PAGE))
                        BottomBar(
                            note = {
                                Column {
                                    Text("That's all the goals you can study at once", Modifier.testTag(HEADING))
                                    Spacer(Modifier.height(240.dp))
                                    Button(onClick = {}, Modifier.testTag(LAST)) { Text("Subscribe") }
                                }
                            },
                            noteRoom = rememberBarNoteRoom(),
                        ) { Button(onClick = {}) { Text("Start") } }
                    }
                }
            }
        }
        compose.waitForIdle()

        val page = compose.onNodeWithTag(PAGE).getUnclippedBoundsInRoot()
        val heading = compose.onNodeWithTag(HEADING).getUnclippedBoundsInRoot()
        assertTrue("the note's heading ($heading) starts below the page's top ($page)", heading.top >= page.top)
        compose.onNodeWithTag(LAST).performScrollTo().assertIsDisplayed()
    }

    private companion object {
        const val PAGE = "page"
        const val HEADING = "heading"
        const val LAST = "last"
        const val BAR = "bar"
    }
}
