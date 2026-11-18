package com.zoonk.android.feature.goalcontent

import androidx.compose.material3.Text
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** As main on a phone: "For reference" lists the chapter summary, then the mind map. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h3000dp")
class ChapterReferenceTest {
    @get:Rule val rule = createComposeRule()

    @Test
    fun onAPhoneTheSummaryComesBeforeTheMap() {
        rule.setContent {
            ZoonkTheme {
                ChapterPage(
                    goalChapter(),
                    PracticeState(),
                    ChapterActions({}, {}, {}, {}),
                    mindMap = ChapterMapSlot(shown = true) { Text("Map row", it) },
                )
            }
        }

        val summary = rule.onNodeWithText("Chapter summary").getBoundsInRoot().top
        val map = rule.onNodeWithText("Map row").getBoundsInRoot().top
        assertTrue("summary at $summary, map at $map", summary < map)
    }
}
