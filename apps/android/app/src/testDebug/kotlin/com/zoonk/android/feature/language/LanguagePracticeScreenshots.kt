package com.zoonk.android.feature.language

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LanguageTodayLevel
import com.zoonk.api.models.LanguageTodayPronunciation
import com.zoonk.api.models.LanguageUnits
import com.zoonk.api.models.LanguageUnitsAlphabet
import com.zoonk.api.models.TodayPattern
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
import java.util.UUID

/**
 * Review screenshots of the alphabet row and Today's language notice, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*LanguagePracticeScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LanguagePracticeScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val goal = UUID.fromString("00000000-0000-4000-8000-000000000050")
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val store =
            AlphabetStore(
                object : AlphabetApi {
                    override suspend fun units(
                        session: AuthenticatedSession,
                        goalId: UUID,
                    ) = LanguageUnits(null, goalId, emptyList())

                    override suspend fun skipAlphabet(
                        session: AuthenticatedSession,
                        goalId: UUID,
                    ) = Unit
                },
                cache,
            )

        fun alphabet(pending: Boolean) = LanguageUnitsAlphabet(null, UUID.randomUUID(), 10, pending, "Hiragana")
        val pattern = TodayPattern(UUID.randomUUID(), TodayPattern.Kind.PATTERN, "Ser and estar")
        val typos = TodayPattern(UUID.randomUUID(), TodayPattern.Kind.TYPOS, "")
        val words = LanguageTodayPronunciation(3, listOf("hola", "gracias", "perro"))

        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        LanguageLevelCard(LanguageTodayLevel("A2+", "B1"), onOpenPlan = {})
                        AlphabetRow(alphabet(pending = true), goal, store, {})
                        AlphabetRow(alphabet(pending = false), goal, store, {})
                        LanguagePracticeNotice(goal, pattern, words, SuggestionLayout.Line, {})
                        LanguagePracticeNotice(goal, typos, null, SuggestionLayout.Line, {})
                        LanguagePracticeNotice(goal, pattern, null, SuggestionLayout.Panel, {})
                    }
                }
            }
        }
        compose.waitForIdle()
        val file = File(folder, "language-practice-$name.png")
        file.parentFile?.mkdirs()
        file.outputStream().use {
            compose
                .onRoot()
                .captureToImage()
                .asAndroidBitmap()
                .compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }
}
