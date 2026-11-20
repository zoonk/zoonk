package com.zoonk.android.feature.player.steps

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.math.formatModelOutput
import com.zoonk.android.feature.player.model.NumericCheck
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.api.models.ActivityExpectedFormulaTolerance
import com.zoonk.api.models.ActivityRoundedAnswer
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

    private fun absolute(value: Double) = ActivityExpectedFormulaTolerance(ActivityExpectedFormulaTolerance.Kind.ABSOLUTE, value)

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
    fun aCheckedAnswerShowsTheFewestDigitsThatKeepItsGrade() {
        val dice = activity("combinationGrid.dice")
        val shown = { check: NumericCheck, rounded: ActivityRoundedAnswer, value: Double, isCorrect: Boolean ->
            formatAmount(
                value,
                Locale.US,
                maximumFractionDigits = check.checkedAnswerDigits(value, isCorrect, rounded, minTolerance = null),
            )
        }
        val distance = check(activity("formulaModel.simulation")).copy(answer = 40.7747, tolerance = absolute(0.01))
        val months = check(activity("formulaModel.calculator")).copy(answer = 251.5421, tolerance = absolute(0.05))

        assertEquals("0.17", shown(check(dice), dice.roundedAnswer!!, 0.1667, true))
        // Just outside the tolerance: 41 would read as right, so the miss keeps the digit that shows it's off.
        assertEquals("40.785", shown(distance, ActivityRoundedAnswer(places = 0, `value` = 41.0), 40.7849, false))
        // Just inside it: 251 would read as wrong, so the hit keeps the digits that show it's close.
        assertEquals("251.5", shown(months, ActivityRoundedAnswer(places = 0, `value` = 252.0), 251.495, true))
    }

    @Test
    fun aModelsAskedOutputReadsAtOnePrecisionWhetherOrNotTheStepAsksForIt() {
        val start = 2653.2977051444223
        val model = activity("formulaModel")
        val explored = formatModelOutput(start, Locale.US, "$", null)
        val asked = formatModelOutput(start, Locale.US, "$", model.roundedAnswer?.places?.toInt())

        assertEquals("$2,653", explored)
        assertEquals(explored, asked)
    }
}
