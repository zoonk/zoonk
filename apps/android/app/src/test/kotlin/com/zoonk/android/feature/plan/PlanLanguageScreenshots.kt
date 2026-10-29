package com.zoonk.android.feature.plan

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.feature.language.languageProgress
import com.zoonk.android.feature.speaking.speakingPaper
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Review screenshots of a language goal's level on the Plan, written only with `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class PlanLanguageScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1000dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h1000dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-xhdpi")
    fun expanded() = capture("expanded", sheets = false)

    /** The page with the level's tile, then the sheet's content as it shows in its sheet: Robolectric copies only the activity's window. */
    private fun capture(
        suffix: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        sheets: Boolean = true,
    ) {
        val summary = learnerSummary(kind = "language", title = "Spanish")
        val page = PlanPageState(summary.goals.first(), learnPlan(), summary)
        val shots =
            mapOf(
                "plan-language-$suffix" to null,
                "plan-language-sheet-paper-$suffix" to languageProgress().copy(speaking = speakingPaper(access = "plusRequired")),
                "plan-language-sheet-mock-$suffix" to languageProgress(level = null, targetDate = null, speakingMock = "ielts"),
            ).filterKeys { sheets || it == "plan-language-$suffix" }
        var shown by mutableStateOf(shots.keys.first())
        compose.setContent {
            val navigator = rememberAppNavigator()
            val links = PlanLinks(navigator, page)
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                val sheet = shots.getValue(shown)
                if (sheet == null) {
                    Surface {
                        PlanContent(
                            page = page,
                            standing = Standing.Language(languageProgress()) { CallStart.Failed },
                            structure = null,
                            links = links,
                            resume = Resume.Plain,
                            isSaving = false,
                            onSetStatus = {},
                            onAdjust = {},
                        )
                    }
                } else {
                    Surface(color = MaterialTheme.colorScheme.surfaceContainerLow) {
                        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(28.dp)) {
                            LanguageDetails(Standing.Language(sheet) { CallStart.Failed }, links)
                        }
                    }
                }
            }
        }
        shots.keys.forEach { name ->
            shown = name
            compose.waitForIdle()
            write(name, compose.onRoot().captureToImage().asAndroidBitmap())
        }
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
