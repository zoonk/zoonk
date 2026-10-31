package com.zoonk.android.feature.mock.result

import android.content.Context
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.R
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "pl")
class MockPointsTest {
    @get:Rule
    val compose = createComposeRule()

    private val context = ApplicationProvider.getApplicationContext<Context>()

    private fun pointsTextFor(value: Double): String {
        var text = ""
        compose.setContent {
            text = pointsText(R.plurals.mock_result_needs_points, R.string.mock_result_needs_points_decimal, value, "X")
        }
        compose.waitForIdle()
        return text
    }

    @Test
    fun aPolishDecimalTakesTheDecimalString() {
        assertEquals(context.getString(R.string.mock_result_needs_points_decimal, "X"), pointsTextFor(1.5))
    }

    @Test
    fun aWholeNumberKeepsItsPluralForm() {
        assertEquals(context.resources.getQuantityString(R.plurals.mock_result_needs_points, 2, "X"), pointsTextFor(2.0))
    }
}
