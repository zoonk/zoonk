package com.zoonk.android.ui.components

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.R
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h900dp")
class SuggestionTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aLineOpensItsContentAndAnAnswerClosesIt() {
        var answered by mutableStateOf(false)
        compose.setContent {
            ZoonkTheme {
                Suggestion(
                    "Plan suggestion",
                    if (answered) "Daily time changed." else "Your time covers 80%",
                    SuggestionLayout.Line,
                    answered = answered,
                ) {
                    SuggestionHeader("Your time covers 80% of the exam")
                    SuggestionActions { SuggestionAction("Use 1 hr a day", onClick = { answered = true }) }
                }
            }
        }

        compose.onNodeWithText("Your time covers 80% of the exam").assertDoesNotExist()
        compose.onNodeWithText("View").performClick()
        compose.onNodeWithText("Use 1 hr a day").performClick()

        compose.onNodeWithText("Your time covers 80% of the exam").assertDoesNotExist()
        compose.onNodeWithText("Daily time changed.").assertIsDisplayed()
    }

    @Test
    fun aPanelShowsItsContentInFull() {
        compose.setContent {
            ZoonkTheme {
                Suggestion("Plan suggestion", "Summary", SuggestionLayout.Panel) {
                    SuggestionHeader("Learn Python is paused")
                    SuggestionDescription("Nothing is planned until you resume it.")
                }
            }
        }

        compose.onNodeWithText("Nothing is planned until you resume it.").assertIsDisplayed()
        compose.onNodeWithText("View").assertDoesNotExist()
    }

    /** Review renders, written only with `-Pzoonk.shots=<folder>`. No goldens. */
    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w411dp-h900dp-xxhdpi")
    fun renders() {
        val folder = System.getProperty("zoonk.shots").orEmpty()
        assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())
        var dark by mutableStateOf(false)
        compose.setContent {
            ZoonkTheme(darkTheme = dark) {
                Surface {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Suggestion("Plan suggestion", "Your time covers 80% of the exam by Nov 7", SuggestionLayout.Line) {}
                        Suggestion(
                            "Plan suggestion",
                            "Daily time changed to 1 hr.",
                            SuggestionLayout.Line,
                            mark = SuggestionMark.Done,
                            answered = true,
                            lineAction = { SuggestionAction("Undo", onClick = {}) },
                        ) {}
                        Suggestion("Paused", "Paused", SuggestionLayout.Panel, mark = SuggestionMark.Symbol(R.drawable.ic_pause)) {
                            SuggestionHeader("Learn Python is paused")
                            SuggestionDescription("Nothing is planned until you resume it.")
                            SuggestionActions {
                                SuggestionAction("Resume", onClick = {})
                                SuggestionAction("Adjust plan", onClick = {}, outlined = true)
                            }
                        }
                    }
                }
            }
        }
        listOf(false, true).forEach {
            dark = it
            compose.waitForIdle()
            write(File(folder, if (it) "suggestion-dark.png" else "suggestion.png"), compose.onRoot().captureToImage().asAndroidBitmap())
        }
    }

    private fun write(
        file: File,
        bitmap: Bitmap,
    ) {
        file.parentFile?.mkdirs()
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
