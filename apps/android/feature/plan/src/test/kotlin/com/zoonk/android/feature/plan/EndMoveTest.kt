package com.zoonk.android.feature.plan

import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlanEffect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate

/** Main's `useEndMoveText`: how precisely a change says the plan's end moves. */
class EndMoveTest {
    @Test
    fun saysBothEndsByTheirDayWhileBothAreByMonthAndNear() {
        val move = move(End("2026-12-10", "month"), End("2026-12-20", "month"))

        assertEquals(EndDate(day("2026-12-10"), EndPrecision.Day) to EndDate(day("2026-12-20"), EndPrecision.Day), move)
    }

    @Test
    fun saysBothEndsByTheirMonthOnceEitherIsPastSixWeeks() {
        val move = move(End("2026-12-10", "month"), End("2027-03-20", "month"))

        assertEquals(EndPrecision.Month to EndPrecision.Month, move?.let { (before, after) -> before.precision to after.precision })
    }

    @Test
    fun saysAFarEndByItsYear() {
        val move = move(End("2027-05-10", "month"), End("2031-05-10", "year"))

        assertEquals(EndPrecision.Month to EndPrecision.Year, move?.let { (before, after) -> before.precision to after.precision })
    }

    @Test
    fun saysNothingWhenBothEndsReadTheSame() {
        assertNull(move(End("2031-02-10", "year"), End("2031-09-10", "year")))
        assertNull(move(End("2027-05-03", "month"), End("2027-05-28", "month")))
    }

    @Test
    fun saysAnEndWithNoPrecisionByItsMonth() {
        val move = move(End("2026-12-10"), End("2027-01-20"))

        assertEquals(EndPrecision.Month to EndPrecision.Month, move?.let { (before, after) -> before.precision to after.precision })
    }

    private data class End(
        val date: String,
        val precision: String? = null,
    )

    private fun move(
        before: End,
        after: End,
    ): Pair<EndDate, EndDate>? {
        val fields =
            listOfNotNull(
                """"endDateBefore":"${before.date}"""",
                """"endDateAfter":"${after.date}"""",
                before.precision?.let { """"endPrecisionBefore":"$it"""" },
                after.precision?.let { """"endPrecisionAfter":"$it"""" },
            )
        return shownEndMove(ApiJson.decodeFromString<PlanEffect>(effect(fields.joinToString(","))), TODAY)
    }

    private fun day(iso: String) = LocalDate.parse(iso)

    private companion object {
        val TODAY: LocalDate = LocalDate.parse("2026-11-28")
    }
}
