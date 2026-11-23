package com.zoonk.android.feature.activities

import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.createFontFamilyResolver
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.sp
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.GraphicsMode

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AxisTitleTest {
    @Test fun longTitleWrapsInsideThePlotAtTwiceTheFontSize() {
        val measurer =
            TextMeasurer(
                defaultFontFamilyResolver = createFontFamilyResolver(ApplicationProvider.getApplicationContext()),
                defaultLocaleList = LocaleList("en-US"),
                defaultDensity = Density(1f, 2f),
                defaultLayoutDirection = LayoutDirection.Ltr,
            )
        val label = measurer.axisTitle("Dollars per month", TextStyle(fontSize = 12.sp), 96f)
        assertTrue(label.lineCount > 1)
        assertTrue(label.size.width <= 96)
        assertFalse(label.hasVisualOverflow)
    }
}
