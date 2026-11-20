package com.zoonk.android.feature.activities.sorting

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.text.style.LineBreak
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.ActivityPhase
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.ui.testing.laidOutStyle
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertNotEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class MatchPairsWrapTest {
    @get:Rule
    val compose = createComposeRule()

    /** A card's words wrap as every sentence does, with the normal rules, so a narrow card in Japanese keeps its places to wrap. */
    @Config(qualifiers = "ja")
    @Test
    fun aCardWrapsByTheNormalRules() {
        compose.setContent {
            ZoonkTheme {
                matchPairsRenderer.canvas(
                    ActivityProps(
                        content = ActivityFixtures.content("matchPairs"),
                        answer = null,
                        expected = null,
                        isCorrect = null,
                        phase = ActivityPhase.Answering,
                        isLocked = false,
                        onAnswerChange = {},
                    ),
                )
            }
        }

        assertNotEquals(LineBreak.Strictness.Strict, compose.laidOutStyle("embarazada").lineBreak.strictness)
    }
}
