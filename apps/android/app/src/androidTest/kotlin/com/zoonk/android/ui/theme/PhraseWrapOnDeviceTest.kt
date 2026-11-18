package com.zoonk.android.ui.theme

import android.content.res.Configuration
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

/**
 * Japanese, like Korean, wraps between phrases, so a label's narrowest width is its longest phrase, never one character.
 * Phrase breaks come from the device's ICU data, which the JVM tests don't have.
 */
@RunWith(AndroidJUnit4::class)
class PhraseWrapOnDeviceTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun aJapaneseLabelAtItsNarrowestBreaksOnlyBetweenPhrases() {
        val label = "まだわからない"
        lateinit var layout: TextLayoutResult
        compose.setContent {
            val japanese = Configuration(LocalConfiguration.current).apply { setLocale(Locale.JAPANESE) }
            CompositionLocalProvider(LocalConfiguration provides japanese) {
                ZoonkTheme {
                    Box(Modifier.width(IntrinsicSize.Min)) {
                        Text(label, style = MaterialTheme.typography.labelLarge, onTextLayout = { layout = it })
                    }
                }
            }
        }
        compose.waitForIdle()

        val ends = (0 until layout.lineCount).map { layout.getLineEnd(it) }
        assertTrue("breaks only after まだ: $ends", ends.all { it == 2 || it == label.length })
    }
}
