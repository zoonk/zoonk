package com.zoonk.android.ui.scaffold

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

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
                BottomBar(
                    Modifier.testTag(BAR),
                    note = if (withNote) ({ Text("That didn't save", Modifier.height(64.dp)) }) else null,
                    noteRoom = room,
                ) { Button(onClick = {}) { Text("Save") } }
            }
        }
        val barOnly = compose.onNodeWithTag(BAR).getUnclippedBoundsInRoot().let { it.bottom - it.top }

        withNote = true
        compose.waitForIdle()

        val withIt = compose.onNodeWithTag(BAR).getUnclippedBoundsInRoot().let { it.bottom - it.top }
        assertEquals("the bar keeps its height", barOnly.value, withIt.value, 1f)
        assertEquals("the note's 64 and its 16 of padding", 80f, room.height.value, 1f)
    }

    private companion object {
        const val BAR = "bar"
    }
}
