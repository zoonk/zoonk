package com.zoonk.android.feature.mock

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.ExamMockSummary
import com.zoonk.api.models.MockShape
import java.time.ZoneId
import kotlin.math.floor
import kotlin.math.roundToLong
import kotlin.time.Instant
import kotlin.time.toJavaInstant

@Composable
fun mockTitle(number: Long): String = stringResource(R.string.mock_title, number)

@Composable
fun mockDaySize(
    fullLength: Boolean,
    day: Long? = null,
): String =
    when {
        day != null && fullLength -> stringResource(R.string.mock_full_day_number, day)
        day != null -> stringResource(R.string.mock_half_day_number, day)
        fullLength -> stringResource(R.string.mock_full_day)
        else -> stringResource(R.string.mock_half_day)
    }

/** What a mock covered: "Starting point" for a placement mock, else its day or subject; empty without a shape. */
@Composable
fun mockShapeLabel(
    placement: Boolean,
    shape: MockShape?,
): String =
    when {
        placement -> stringResource(R.string.mock_starting_point)
        shape == null -> ""
        shape.kind == MockShape.Kind.AREA -> shape.area.orEmpty()
        else -> mockDaySize(fullLength = shape.kind == MockShape.Kind.FULL)
    }

/** "Oct 28", in the device's time zone as main writes it in the browser's. */
@Composable
fun mockDate(finishedAt: Instant): String =
    formatDate(
        finishedAt
            .toJavaInstant()
            .atZone(ZoneId.systemDefault())
            .toLocalDate(),
        currentLocale(),
        DateStyle.Day,
    )

/**
 * What a finished mock certainly was: its net score where wrong answers cancel right ones, else its
 * right answers (an IRT score is only ever an estimate, shown as a range on the Plan).
 */
@Composable
fun mockMeasure(mock: ExamMockSummary): String {
    val locale = currentLocale()
    if (mock.scoring == ExamMockSummary.Scoring.NET) {
        return stringResource(R.string.mock_net_score, formatNumber(mock.measure, locale), mock.total)
    }
    // Partial credit reads to the hundredth.
    val correct = (mock.correct * HUNDREDTHS).roundToLong() / HUNDREDTHS
    return pluralStringResource(R.plurals.mock_right_answers, floor(correct).toInt(), formatNumber(correct, locale), mock.total)
}

/** "Mock exam 2" with how it went in words, for a row. */
@Composable
fun mockSummaryLabel(mock: ExamMockSummary): String {
    val shape = mockShapeLabel(mock.purpose == ExamMockSummary.Purpose.PLACEMENT, mock.shape)
    val examQuestions = mock.examQuestions
    return if (examQuestions != null && examQuestions > mock.total) {
        pluralStringResource(R.plurals.mock_shape_of_questions, mock.total.toInt(), shape, mock.total, examQuestions)
    } else {
        shape
    }
}

private const val HUNDREDTHS = 100.0
