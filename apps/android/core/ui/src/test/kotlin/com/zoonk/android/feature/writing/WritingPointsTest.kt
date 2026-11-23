package com.zoonk.android.feature.writing

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.Locale

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "en")
class WritingPointsTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun onlyHeadlinesRoundOutward() {
        assertEquals("16" to "19", rangeEnds(16.6, 18.1, 0, Locale.ENGLISH, headline = true))
        assertEquals("17" to "18", rangeEnds(16.6, 18.1, 0, Locale.ENGLISH, headline = false))
        assertEquals("4.8" to "7.1", rangeEnds(4.88, 7.01, 1, Locale.ENGLISH, headline = true))
        assertEquals("4.9" to "7.0", rangeEnds(4.88, 7.01, 1, Locale.ENGLISH, headline = false))
        assertEquals("0.3" to "0.3", rangeEnds(0.1 + 0.2, 0.1 + 0.2, 1, Locale.ENGLISH, headline = true))
    }

    @Test
    fun deductionsRoundToOneDecimalWithoutNegativeZero() {
        compose.setContent {
            Column {
                Text(deductionRange(0.01, 0.04))
                Text(deductionRange(0.04, 0.14))
                Text(deductionRange(0.25, 0.56))
            }
        }

        compose.onNodeWithText("0").assertIsDisplayed()
        compose.onNodeWithText("0.0 to −0.1").assertIsDisplayed()
        compose.onNodeWithText("−0.3 to −0.6").assertIsDisplayed()
    }
}
