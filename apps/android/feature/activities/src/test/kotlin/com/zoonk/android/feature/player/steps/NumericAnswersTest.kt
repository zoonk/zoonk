package com.zoonk.android.feature.player.steps

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.math.formatModelOutput
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.ui.format.formatAmount
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Value as NumericCheckValue

/** Every number written for a numeric answer uses the precision its rounding hint names, which core decides. */
@RunWith(AndroidJUnit4::class)
class NumericAnswersTest {
    private fun activity(name: String) = ActivityFixtures.step(name).content as StepContent.Activity

    private fun check(activity: StepContent.Activity) = (activity.frame.check as NumericCheckValue).value

    private fun written(
        number: WrittenNumber,
        unit: String? = null,
    ) = formatAmount(number.value, Locale.US, unit, maximumFractionDigits = number.digits)

    @Test
    fun theRightAnswerIsWrittenToTheHintsPlaces() {
        val money = activity("formulaModel")
        val dice = activity("combinationGrid.dice")
        val months = activity("formulaModel.calculator")

        assertEquals("$3,870", written(check(money).rightAnswer(money.roundedAnswer), "$"))
        assertEquals("0.17", written(check(dice).rightAnswer(dice.roundedAnswer)))
        assertEquals("252", written(check(months).rightAnswer(months.roundedAnswer)))
    }

    @Test
    fun aCheckedAnswerKeepsTheHintsPlacesUnlessAWrongOneWouldReadAsRight() {
        val dice = activity("combinationGrid.dice")

        assertEquals(2, check(dice).checkedAnswerDigits(0.1667, isCorrect = true, rounded = dice.roundedAnswer))
        assertEquals(2, check(dice).checkedAnswerDigits(0.25, isCorrect = false, rounded = dice.roundedAnswer))
        assertEquals("0.174", formatAmount(0.174, Locale.US, maximumFractionDigits = check(dice).checkedAnswerDigits(0.174, false, dice.roundedAnswer)))
    }

    @Test
    fun aModelsAskedOutputReadsAtOnePrecisionWhetherOrNotTheStepAsksForIt() {
        val start = 2653.2977051444223
        val explored = formatModelOutput(start, Locale.US, "$", null, null)
        val asked = formatModelOutput(start, Locale.US, "$", 3869.68, 0.01)

        assertEquals("$2,653", explored)
        assertEquals(explored, asked)
    }
}
