package com.zoonk.android.feature.plan

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.LineBreak
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class PlanRoadmapWrapTest {
    @get:Rule
    val compose = createComposeRule()

    /** The axis's dates are short labels: in Korean they keep wrapping between phrases, "1~3일차(총" never parted from "7일)" by a bracket. */
    @Config(qualifiers = "ko")
    @Test
    fun theKoreanAxisWrapsBetweenPhrases() {
        lateinit var style: TextStyle
        compose.setContent { ZoonkTheme { style = axisStyle() } }
        compose.waitForIdle()

        assertEquals(LineBreak.WordBreak.Phrase, style.lineBreak.wordBreak)
    }
}
