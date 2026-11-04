package com.zoonk.android.ui.scaffold

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class WindowPostureTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    /** A screen opened on an open book lays out at its fold from its first frame, never one column first. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun aScreenOpenedOnAnOpenBookSeesTheFoldOnItsFirstFrame() {
        var opened by mutableStateOf(false)
        var firstFold: PageFold? = null
        rule.setContent {
            ZoonkTheme {
                if (opened) {
                    BoxWithConstraints(Modifier.fillMaxSize()) {
                        val fold = pageFold(maxWidth)
                        val first = remember { fold }
                        SideEffect { firstFold = first }
                    }
                }
            }
        }
        rule.unfoldBook(folds)

        rule.runOnIdle { opened = true }
        rule.waitForIdle()

        assertNotNull("the screen's first frame saw no fold", firstFold)
    }

    /** Where WindowManager can't tell the folds at once, the window draws nothing until their first reading arrives. */
    @Test
    fun theWindowDrawsOnceItsFoldsAreRead() {
        rule.mainClock.autoAdvance = false
        rule.setContent { ZoonkTheme {} }
        assertTrue("the window drew before its folds were read", drawingHeld())

        rule.unfoldBook(folds)
        rule.mainClock.advanceTimeByFrame()

        assertFalse("the window kept waiting after its folds were read", drawingHeld())
    }

    /** A device that never reports its folds still shows the app. */
    @Test
    fun aWindowWhoseFoldsAreNeverReadDrawsAfterAWhile() {
        rule.mainClock.autoAdvance = false
        rule.setContent { ZoonkTheme {} }

        repeat(HELD_FRAMES) { drawingHeld() }

        assertFalse("the window never drew", drawingHeld())
    }

    private fun drawingHeld(): Boolean =
        rule.runOnUiThread {
            rule.activity.window.decorView.viewTreeObserver
                .dispatchOnPreDraw()
        }
}
