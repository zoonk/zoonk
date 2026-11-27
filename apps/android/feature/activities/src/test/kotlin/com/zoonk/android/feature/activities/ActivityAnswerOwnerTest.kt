package com.zoonk.android.feature.activities

import com.zoonk.android.feature.player.model.canvasOwnsAnswer
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@org.junit.runner.RunWith(androidx.test.ext.junit.runners.AndroidJUnit4::class)
class ActivityAnswerOwnerTest {
    @Test
    fun aGuessUsesItsSliderInsteadOfAddingANumberField() {
        assertTrue(canvasOwnsAnswer("guessReveal"))
    }

    @Test
    fun aModelsReadoutKeepsTheSamePrecisionAsItsSettingsChange() {
        org.junit.Assert.assertEquals(
            "35 m",
            com.zoonk.android.feature.activities.math
                .formatModelOutput(35.31, java.util.Locale.ENGLISH, "m", 0),
        )
        org.junit.Assert.assertEquals(
            "41 m",
            com.zoonk.android.feature.activities.math
                .formatModelOutput(40.77, java.util.Locale.ENGLISH, "m", 0),
        )
    }

    @Test
    fun aChartKeepsItsFrameAnswer() {
        assertFalse(canvasOwnsAnswer("chartReader"))
        assertFalse(canvasOwnsAnswer("formulaModel"))
        assertFalse(canvasOwnsAnswer("beforeAfter"))
    }
}
