package com.zoonk.android.feature.onboarding

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.onboarding.setup.PlacementFormat
import com.zoonk.android.feature.onboarding.setup.PlacementItem
import com.zoonk.android.feature.onboarding.setup.PlacementQuestion
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.feature.practice.SaveErrorText
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.TrueFalseLabels
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class SaveFailureScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w700dp-h1000dp-xhdpi")
    fun medium() = capture("medium")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-xhdpi")
    fun expanded() = capture("expanded")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xhdpi")
    fun darkMoreContrast() = capture("phone-dark-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xhdpi")
    fun largeText() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-200-percent")
    }

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        var placement by mutableStateOf(true)
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface {
                    Column(Modifier.fillMaxSize().padding(if (placement) 24.dp else 0.dp)) {
                        if (placement) {
                            SetupColumn {
                                PlacementQuestion(
                                    item =
                                        PlacementItem(
                                            itemId = ITEM_ID,
                                            question = "Which court hears appeals from state courts?",
                                            context = null,
                                            image = null,
                                            visual = null,
                                            format =
                                                PlacementFormat.Choice(
                                                    listOf("The Supreme Court", "A district court", "A county court"),
                                                ),
                                        ),
                                    eyebrow = "Bar exam · Question 3",
                                    labels = TrueFalseLabels.TRUE_FALSE,
                                    typedWords = null,
                                    pending = false,
                                    saveFailures = 2,
                                    onAnswer = { _, _ -> },
                                    onStop = {},
                                )
                            }
                        } else {
                            SaveErrorText(failures = 2, onReport = {})
                        }
                    }
                }
            }
        }
        write("jvm-placement-repeat-save-failure-with-report-$name-fixed")
        compose.runOnIdle { placement = false }
        write("jvm-repeat-line-with-report-$name-fixed")
    }

    private fun write(name: String) {
        val bitmap = compose.onRoot().captureRender().asAndroidBitmap()
        File(folder).mkdirs()
        File(folder, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
