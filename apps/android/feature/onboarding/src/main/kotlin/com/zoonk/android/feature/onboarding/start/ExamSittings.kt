package com.zoonk.android.feature.onboarding.start

import com.zoonk.api.models.OnboardingExamDate
import kotlinx.datetime.toJavaLocalDate
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.abs

/**
 * Core's `packages/core/src/exams/kept-month.ts` and `_utils/exam-sittings.ts`, which main runs on
 * the device to word "Here's what I understood": days at most two weeks apart are one sitting.
 */
internal object ExamSittings {
    private const val SITTING_GAP_DAYS = 14L

    fun group(days: List<OnboardingExamDate>): List<List<OnboardingExamDate>> =
        days.sortedBy { it.day }.fold(emptyList()) { sittings, day ->
            val current = sittings.lastOrNull()
            val previous = current?.lastOrNull()
            if (previous != null && ChronoUnit.DAYS.between(previous.day, day.day) <= SITTING_GAP_DAYS) {
                sittings.dropLast(1) + listOf(current + day)
            } else {
                sittings + listOf(listOf(day))
            }
        }

    fun hasSeveral(days: List<OnboardingExamDate>) = group(days).size > 1

    fun openSittings(
        count: Int,
        days: List<OnboardingExamDate>,
        from: LocalDate,
    ): List<OnboardingExamDate> = ahead(days, from).filter(::isOpen).take(count).map { it.first() }

    fun learnerSitting(
        days: List<OnboardingExamDate>,
        from: LocalDate,
        goalDate: LocalDate?,
    ): List<OnboardingExamDate>? {
        val ahead = ahead(days, from)
        if (group(days).size == 1) return ahead.firstOrNull()
        if (goalDate == null) return ahead.firstOrNull(::isOpen) ?: ahead.firstOrNull()

        return ahead
            .filter { sitting -> sitting.any { it.day.year == goalDate.year && it.day.month == goalDate.month } }
            .minByOrNull { sitting -> sitting.minOf { abs(ChronoUnit.DAYS.between(goalDate, it.day)) } }
    }

    /** The day the learner's words or date point to: their month's sitting, or the next open one. */
    fun meantDay(
        days: List<OnboardingExamDate>,
        details: Map<String, JsonElement>?,
        from: LocalDate,
        goalDate: LocalDate?,
    ): OnboardingExamDate? {
        val wanted = goalDate?.takeIf { it >= from } ?: namedMonthStart(details, from)
        return learnerSitting(days, from, wanted)
            ?.filter { it.day >= from }
            ?.minByOrNull { it.day }
    }

    /** The start of the month the learner named for the exam, while it's still ahead. */
    fun namedMonthStart(
        details: Map<String, JsonElement>?,
        from: LocalDate,
    ): LocalDate? {
        val month = examMonth(details) ?: return null
        val year = examYear(details) ?: return null
        return LocalDate.of(year, month, 1).takeIf { it > from }
    }

    /** The learner's named month when the notice puts the exam in another one: theirs stays until they pick. */
    fun keptMonthStart(
        details: Map<String, JsonElement>?,
        noticeDay: LocalDate?,
        today: LocalDate,
    ): LocalDate? {
        val named = namedMonthStart(details, today) ?: return null
        noticeDay ?: return null
        return named.takeIf { it.year != noticeDay.year || it.month != noticeDay.month }
    }

    fun examMonth(details: Map<String, JsonElement>?): Int? = details?.integer("examMonth")?.takeIf { it in 1..12 }

    fun examYear(details: Map<String, JsonElement>?): Int? = details?.integer("examYear")

    private fun ahead(
        days: List<OnboardingExamDate>,
        from: LocalDate,
    ) = group(days).filter { sitting -> sitting.any { it.day >= from } }

    private fun isOpen(sitting: List<OnboardingExamDate>) = sitting.none { it.registrationClosed }
}

internal val OnboardingExamDate.day: LocalDate get() = date.toJavaLocalDate()

private fun Map<String, JsonElement>.integer(key: String): Int? =
    (get(key) as? JsonPrimitive)
        ?.takeUnless { it.isString }
        ?.doubleOrNull
        ?.takeIf { it % 1.0 == 0.0 }
        ?.toInt()
