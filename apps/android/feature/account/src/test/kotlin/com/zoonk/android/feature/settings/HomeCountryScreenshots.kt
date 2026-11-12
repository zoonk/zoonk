package com.zoonk.android.feature.settings

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LearningProfileApi
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.feature.country.CountryChoice
import com.zoonk.android.feature.country.CountryStore
import com.zoonk.android.feature.country.LocalCountryCatalog
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearningProfile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Review screenshots of Preferences' "Where you live", written only with `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class HomeCountryScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "pt-rBR-w411dp-h891dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "pt-rBR-w411dp-h891dp-night-xxhdpi")
    fun phoneDark() = capture("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "pt-rBR-w411dp-h1400dp-xhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200", interactive = false)
    }

    private fun profile(home: Boolean): LearningProfile =
        ApiJson.decodeFromString(
            """{"activeGoalId":null,"availableGlasses":["round"],"homeCountry":${if (home) "\"PT\"" else "null"},
               "homeCountryName":${if (home) "\"Portugal\"" else "null"},
               "suggested":[{"code":"PT","name":"Portugal","lessonVariety":{"language":"pt","region":"BR"},"tag":"home"},
                 {"code":"BR","name":"Brasil","lessonVariety":null,"tag":null}],
               "buddy":{"glasses":"round","kind":"zu","name":null,"picked":false},"shareUsageData":null,"soundsEnabled":true}""",
        )

    private fun capture(
        suffix: String,
        dark: Boolean = false,
        interactive: Boolean = true,
    ) {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val countries =
            CountryStore({ listOf(CountryChoice("DE", "Alemanha"), CountryChoice("BR", "Brasil"), CountryChoice("PT", "Portugal")) }, cache)
        val preferences =
            PreferencesViewModel(
                LearningProfileStore(
                    object : LearningProfileApi {
                        override suspend fun profile(session: AuthenticatedSession) = profile(home = false)

                        override suspend fun update(
                            session: AuthenticatedSession,
                            change: kotlinx.serialization.json.JsonObject,
                        ) = profile(home = true)
                    },
                    cache,
                ),
            )
        var home by mutableStateOf(false)

        compose.setContent {
            ZoonkTheme(darkTheme = dark) {
                CompositionLocalProvider(LocalCountryCatalog provides countries.catalog) {
                    Surface { Column(Modifier.padding(vertical = 16.dp)) { LanguageSection(profile(home), preferences) } }
                }
            }
        }
        compose.waitForIdle()
        write("settings-home-country-unset-$suffix", compose.onRoot().captureRender().asAndroidBitmap())
        home = true
        compose.waitForIdle()
        write("settings-home-country-set-$suffix", compose.onRoot().captureRender().asAndroidBitmap())
        if (interactive) {
            compose.onNodeWithText("Onde você mora").performClick()
            compose.waitForIdle()
            write("settings-home-country-picker-$suffix", compose.onNode(isDialog()).captureRender().asAndroidBitmap())
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
