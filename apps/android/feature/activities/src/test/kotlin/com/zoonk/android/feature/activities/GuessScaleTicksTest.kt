package com.zoonk.android.feature.activities

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.format.formatAmount
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

@RunWith(AndroidJUnit4::class)
class GuessScaleTicksTest {
    @Test fun moneyTicksInMillionsShortenTogetherAndKeepTheirCurrency() {
        val scale = GuessScale(0.0, 2_000_000.0, false)
        val labels =
            scale.tickLabels {
                value,
                compact,
                ->
                formatAmount(value, Locale.US, "R$", compact = compact, maximumFractionDigits = if (compact) 1 else null)
            }
        assertTrue(labels.all { it.contains("R$") })
        assertTrue(labels.contains("R$1.5M"))
        assertTrue(labels.contains("R$2M"))
        assertEquals(
            listOf("R$0", "R$25", "R$50", "R$75", "R$100"),
            GuessScale(0.0, 100.0, false).tickLabels {
                value,
                compact,
                ->
                formatAmount(value, Locale.US, "R$", compact = compact, maximumFractionDigits = if (compact) 1 else null)
            },
        )
    }

    @Test fun crowdedTicksGiveWayWithoutOverlappingTheEndLabels() {
        val scale = GuessScale(0.0, 2_000_000.0, false)
        val widthOf = { value: Double -> if (value == 0.0) 30 else 68 }
        val shown = scale.fittedTicks(240, widthOf)
        assertEquals(listOf(0.0, 1_000_000.0, 2_000_000.0), shown)
        val boxes =
            shown.map { value ->
                val width = widthOf(value)
                val x = (scale.shareOf(value) * 240 - width / 2.0).coerceIn(0.0, 240.0 - width)
                x to x + width
            }
        boxes.zipWithNext().forEach { (a, b) -> assertTrue(a.second + 4 <= b.first) }
    }
}
