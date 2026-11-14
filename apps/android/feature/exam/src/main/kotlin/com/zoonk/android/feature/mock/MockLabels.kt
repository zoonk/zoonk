package com.zoonk.android.feature.mock

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMomentDay
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.ExamMockSummary
import com.zoonk.api.models.MockShape
import kotlin.math.floor
import kotlin.math.roundToLong
import kotlin.time.Instant

@Composable
fun mockTitle(number: Long): String = stringResource(R.string.mock_title, number)

/** A one-subject mock exam is told apart by its subject; a full or half one needs no label. */
fun mockSubject(shape: MockShape?): String = if (shape?.kind == MockShape.Kind.AREA) shape.area.orEmpty() else ""

/** "Oct 28", or "Oct 28, 2025" in another year, in the device's time zone as main writes it in the browser's. */
@Composable
fun mockDate(finishedAt: Instant): String = formatMomentDay(finishedAt, currentLocale())

/** What a finished mock exam certainly was: its score where wrong answers cost points, else its right answers. */
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

private const val HUNDREDTHS = 100.0
