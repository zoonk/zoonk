package com.zoonk.android.feature.player.steps

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ScreenWorkTest {
    @get:Rule val rule = createComposeRule()

    /** A retry starts a new round; the first attempt's work stays for its earlier copy to show. */
    @Test
    fun keepsTheFirstAttemptsWorkAfterItsRetryStarts() {
        var shownRound by mutableIntStateOf(0)
        var firstRound by mutableStateOf<Int?>(null)
        var draft = ""
        var write: (String) -> Unit = {}

        rule.setContent {
            val work = rememberScreenWork(rememberSaveableStateHolder(), "quiz", shownRound, firstRound)
            work.Page(turn = true) {
                var text by rememberSaveable { mutableStateOf("") }
                draft = text
                write = { text = it }
            }
        }

        rule.runOnIdle { write("print(42)") }
        rule.runOnIdle {
            firstRound = 0
            shownRound = 1
        }
        rule.waitForIdle()
        assertEquals("", draft)

        rule.runOnIdle { shownRound = 0 }
        rule.waitForIdle()
        assertEquals("print(42)", draft)
    }
}
