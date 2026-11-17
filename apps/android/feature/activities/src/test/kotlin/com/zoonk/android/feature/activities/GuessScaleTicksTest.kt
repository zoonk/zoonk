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
        val widths = listOf(30, 68, 55, 68, 55)
        val spots = scale.tickPlacements(180, widths)
        assertNotNull(spots.first())
        assertNotNull(spots.last())
        val shown = spots.indices.filter { spots[it] != null }
        shown.zipWithNext().forEach { (a, b) -> assertTrue(spots[a]!! + widths[a] + 4 <= spots[b]!!) }
    }
}
