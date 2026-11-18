package com.zoonk.android.ui.scaffold

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class DetailPageTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    /** A bar under both panes draws its note over both, so the aside beside the column ends clear of it too, as the column does. */
    @Config(qualifiers = "w1280dp-h800dp-land")
    @Test
    fun theAsideBesideEndsClearOfTheBarsNote() {
        compose.setContent {
            ZoonkTheme {
                val room = rememberBarNoteRoom()
                Column {
                    DetailPage(
                        aside = { repeat(20) { Text("Part $it", Modifier.height(48.dp).let { line -> if (it == 19) line.testTag(LAST) else line }) } },
                        asideLabel = "Picked",
                        modifier = Modifier.weight(1f),
                        noteRoom = room,
                    ) { item { Text("Mocks") } }
                    BottomBar(note = { Text("Subscribe to start", Modifier.height(96.dp).testTag(NOTE)) }, noteRoom = room) {
                        Button(onClick = {}) { Text("Start") }
                    }
                }
            }
        }

        compose.onNode(hasScrollAction() and hasAnyDescendant(hasTestTag(LAST))).performSemanticsAction(SemanticsActions.ScrollBy) {
            it(0f, 10_000f)
        }
        compose.waitForIdle()

        val last = compose.onNodeWithTag(LAST).getUnclippedBoundsInRoot()
        val note = compose.onNodeWithTag(NOTE).getUnclippedBoundsInRoot()
        assertTrue("the aside's last line ($last) ends above the note ($note)", last.bottom <= note.top)
    }

    private companion object {
        const val LAST = "last"
        const val NOTE = "note"
    }
}
