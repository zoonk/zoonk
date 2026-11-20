package com.zoonk.android.ui.scaffold

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.Dp
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

    /** A note taller than the room between the page's content and the bar goes into the page's scroll, scrolled into view. */
    @Config(qualifiers = "w640dp-h320dp-land", fontScale = 2f)
    @Test
    fun aNoteTallerThanItsRoomMovesIntoThePagesScroll() {
        val room = BarNoteRoom()
        compose.setContent {
            ZoonkTheme {
                PageScaffold(onBack = {}, title = { Text("Learn piano") }) { padding ->
                    Column(Modifier.fillMaxSize().padding(padding)) {
                        Column(
                            Modifier
                                .weight(1f)
                                .fillMaxWidth()
                                .barNoteViewport(room)
                                .testTag(PAGE)
                                .verticalScroll(rememberScrollState()),
                        ) {
                            Spacer(Modifier.height(600.dp))
                            BarNoteInPage(room)
                        }
                        BottomBar(note = { TallNote() }, noteRoom = room) { Button(onClick = {}) { Text("Start") } }
                    }
                }
            }
        }
        compose.waitForIdle()

        val page = compose.onNodeWithTag(PAGE).getUnclippedBoundsInRoot()
        val heading = compose.onNodeWithTag(HEADING).assertIsDisplayed().getUnclippedBoundsInRoot()
        assertTrue("the note's heading ($heading) starts in the page ($page)", heading.top >= page.top)
        assertEquals("the page keeps no room for a note it holds", 0f, room.height.value, 0f)
        compose.onNodeWithTag(LAST).performScrollTo().assertIsDisplayed()
    }

    /** A lazy page takes a note too tall to draw over it as its last item, scrolled into view. */
    @Config(qualifiers = "w640dp-h320dp-land", fontScale = 2f)
    @Test
    fun aLazyPageScrollsToTheNoteItTakes() {
        compose.setContent {
            ZoonkTheme {
                val list = rememberLazyListState()
                val room = rememberBarNoteRoom(list)
                Column(Modifier.fillMaxSize()) {
                    LazyColumn(Modifier.weight(1f).barNoteViewport(room).testTag(PAGE), state = list) {
                        items(40) { Text("Row $it", Modifier.height(48.dp)) }
                        barNoteInPage(room)
                    }
                    BottomBar(note = { TallNote() }, noteRoom = room) { Button(onClick = {}) { Text("Start") } }
                }
            }
        }
        compose.waitForIdle()

        val page = compose.onNodeWithTag(PAGE).getUnclippedBoundsInRoot()
        val heading =
            compose
                .onNode(
                    hasTestTag(HEADING) and hasAnyAncestor(hasTestTag(PAGE)),
                ).assertIsDisplayed()
                .getUnclippedBoundsInRoot()
        assertTrue("the note's heading ($heading) starts in the page ($page)", heading.top >= page.top)
    }

    /** With no top bar, the page's own top bounds the room: a note that fits there draws over the page whole, not cut to a guessed toolbar. */
    @Config(qualifiers = "w640dp-h320dp-land")
    @Test
    fun aNoteThatFitsUnderAPageWithoutATopBarDrawsWhole() {
        val room = BarNoteRoom()
        var noteHeight by mutableStateOf<Dp?>(null)
        compose.setContent {
            ZoonkTheme {
                Column(Modifier.fillMaxSize()) {
                    Box(
                        Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .barNoteViewport(room)
                            .testTag(PAGE),
                    )
                    BottomBar(
                        note = noteHeight?.let { height -> { Spacer(Modifier.height(height)) } },
                        noteRoom = room,
                    ) { Button(onClick = {}) { Text("Start") } }
                }
            }
        }
        val page = compose.onNodeWithTag(PAGE).getUnclippedBoundsInRoot().let { it.bottom - it.top }

        noteHeight = page - 44.dp
        compose.waitForIdle()

        assertEquals("the note draws its full height over the page", (page - 20.dp).value, room.height.value, 1f)
    }

    @Composable
    private fun TallNote() {
        Column {
            Text("That's all the goals you can study at once", Modifier.testTag(HEADING))
            Spacer(Modifier.height(240.dp))
            Button(onClick = {}, Modifier.testTag(LAST)) { Text("Subscribe") }
        }
    }

    private companion object {
        const val PAGE = "page"
        const val HEADING = "heading"
        const val LAST = "last"
        const val BAR = "bar"
    }
}
