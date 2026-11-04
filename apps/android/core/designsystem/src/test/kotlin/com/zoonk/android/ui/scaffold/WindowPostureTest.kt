package com.zoonk.android.ui.scaffold

import android.view.View
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.ui.components.AlertDialog
import com.zoonk.android.ui.components.DropdownMenu
import com.zoonk.android.ui.components.ModalBottomSheet
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

    /** A dialog, a sheet or a menu restored with its screen waits in its own window too. */
    @OptIn(ExperimentalMaterial3Api::class)
    @Test
    fun dialogsSheetsAndMenusWaitForTheFoldsInTheirOwnWindows() {
        rule.mainClock.autoAdvance = false
        var dialog: View? = null
        var sheet: View? = null
        var menu: View? = null
        rule.setContent {
            ZoonkTheme {
                AlertDialog(onDismissRequest = {}, confirmButton = {
                    val view = LocalView.current
                    SideEffect { dialog = view }
                })
                ModalBottomSheet(onDismissRequest = {}) {
                    val view = LocalView.current
                    SideEffect { sheet = view }
                }
                Box {
                    DropdownMenu(expanded = true, onDismissRequest = {}) {
                        val view = LocalView.current
                        SideEffect { menu = view }
                    }
                }
            }
        }

        assertTrue("the dialog drew before the folds were read", rule.runOnUiThread { dialog!!.viewTreeObserver.dispatchOnPreDraw() })
        assertTrue("the sheet drew before the folds were read", rule.runOnUiThread { sheet!!.viewTreeObserver.dispatchOnPreDraw() })
        assertTrue("the menu drew before the folds were read", rule.runOnUiThread { menu!!.viewTreeObserver.dispatchOnPreDraw() })
    }

    private fun drawingHeld(): Boolean =
        rule.runOnUiThread {
            rule.activity.window.decorView.viewTreeObserver
                .dispatchOnPreDraw()
        }
}
