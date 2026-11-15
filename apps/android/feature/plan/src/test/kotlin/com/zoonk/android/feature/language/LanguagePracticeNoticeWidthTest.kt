package com.zoonk.android.feature.language

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LanguageTodayPronunciation
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.util.UUID

/** RV80's reproduction: Today's pronunciation notice on the narrowest phone at 200%, in Portuguese. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "pt-rBR-w320dp-h900dp")
class LanguagePracticeNoticeWidthTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aLongActionAtLargeTextOnTheNarrowestPhoneGoesUnderTheWords() {
        RuntimeEnvironment.setFontScale(2f)
        compose.setContent {
            ZoonkTheme {
                Box(Modifier.width(288.dp)) {
                    LanguagePracticeNotice(
                        UUID.fromString("00000000-0000-4000-8000-000000000001"),
                        null,
                        LanguageTodayPronunciation(3, listOf("hello", "world", "again")),
                        SuggestionLayout.Line,
                        {},
                    )
                }
            }
        }
        compose.waitForIdle()

        compose.onNodeWithText("Repetir as palavras").assertIsDisplayed()
    }
}
