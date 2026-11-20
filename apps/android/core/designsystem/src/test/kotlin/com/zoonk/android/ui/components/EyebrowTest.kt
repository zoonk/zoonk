package com.zoonk.android.ui.components

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.text.style.LineBreak
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.testing.laidOutStyle
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class EyebrowTest {
    @get:Rule
    val compose = createComposeRule()

    /** The chip is a short label, so in Japanese it wraps between phrases and never splits 予想. */
    @Config(qualifiers = "ja")
    @Test
    fun aJapaneseChipWrapsBetweenPhrases() {
        compose.setContent { ZoonkTheme { Eyebrow("予想なので、採点されません") } }

        assertEquals(LineBreak.WordBreak.Phrase, compose.laidOutStyle("予想").lineBreak.wordBreak)
    }
}
