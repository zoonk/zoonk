package com.zoonk.android.app.shell

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearnerSummaryGoal
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Review screenshots of the Make room sheet's content, written only with `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MakeRoomScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = capture("make-room-phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("make-room-phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phonePausingAfterAFailedStart() = capture("make-room-phone-pausing-failed", pausing = true, failed = true)

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("make-room-phone-font200")
    }

    @Test
    @Config(qualifiers = "de-w411dp-h1400dp-xhdpi")
    fun phoneInGermanAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("make-room-phone-de-font200")
    }

    @Test
    @Config(qualifiers = "w700dp-h1000dp-xhdpi")
    fun medium() = capture("make-room-medium")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun expanded() = capture("make-room-expanded")

    /** Robolectric copies only the activity's window, so the sheet's content is drawn here as it shows in its sheet. */
    @OptIn(ExperimentalMaterial3Api::class)
    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        pausing: Boolean = false,
        failed: Boolean = false,
    ) {
        val goals = listOf(goal(1, "Quantum physics"), goal(2, "Spanish for a year abroad in Buenos Aires", "ar"), goal(3, "Bar exam"))
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface(Modifier.fillMaxSize()) {
                    Box(contentAlignment = Alignment.BottomCenter) {
                        Surface(
                            modifier = Modifier.widthIn(max = BottomSheetDefaults.SheetMaxWidth),
                            shape = BottomSheetDefaults.ExpandedShape,
                            color = BottomSheetDefaults.ContainerColor,
                        ) {
                            Box(Modifier.padding(top = 24.dp)) {
                                MakeRoomContent(
                                    waitingName = "Statistics",
                                    active = goals,
                                    pausing = goals.first().id.takeIf { pausing },
                                    failed = failed,
                                    onPause = {},
                                    onGetPlus = {},
                                )
                            }
                        }
                    }
                }
            }
        }
        val bitmap = compose.onRoot().captureRender().asAndroidBitmap()
        File(folder).mkdirs()
        File(folder, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun goal(
        number: Int,
        name: String,
        flag: String? = null,
    ): LearnerSummaryGoal =
        ApiJson.decodeFromString(
            """
            {"courseChapterId":null,"courseId":null,"courseLevel":null,"dailyMinutes":20,"language":"en",
             "id":"0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c0a$number","isActive":${number == 1},"isSettingUp":false,
             "kind":"${if (flag == null) "learn" else "language"}","languageFlag":${flag?.let { "\"$it\"" }},"status":"active",
             "targetDate":null,"targetLanguage":${flag?.let { "\"es\"" }},"targetRegion":${flag?.let { "\"$it\"" }},
             "regionChoices":[],"contentCountry":null,"countryDependent":false,"examCountry":null,"examplesCountry":null,"languageCountry":{"code":"US","name":"United States"},"suggested":[],"title":"$name","displayName":"$name"}
            """.trimIndent(),
        )
}
