package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.writing.MarkedLine
import com.zoonk.android.feature.writing.WrittenStandingLine
import com.zoonk.android.feature.writing.pointsRange
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.pluralQuantity
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.MockPoints
import com.zoonk.api.models.MockPointsUnjudgedInner
import com.zoonk.api.models.PointsMinimum
import com.zoonk.api.models.WrittenPartPoints
import com.zoonk.api.models.WrittenPartPointsMinimum
import kotlin.math.roundToLong

/** A test of the exam, or its objective tests together when [name] is null. */
internal data class TestRow(
    val name: String?,
    val asked: Double,
    val earned: Double,
    val max: Double?,
    val met: Boolean?,
    val minimum: PointsMinimum?,
    val projected: Double?,
    val short: Double?,
    val qualifying: Boolean,
)

/**
 * Misses first, so what would eliminate the learner is read before what went fine. The total joins
 * the tests when it has a minimum to judge, or when a missed minimum takes the result's headline,
 * which is where the total showed.
 */
internal fun testRows(points: MockPoints): List<TestRow> {
    val parts =
        points.parts.map {
            TestRow(it.name, it.asked, it.earned, it.max, it.met, it.minimum, it.projected, it.short, it.qualifying)
        }
    val headlineTaken = points.parts.any { it.met == false }
    val together =
        TestRow(
            null,
            points.asked,
            points.earned,
            points.max,
            points.met,
            points.minimum,
            points.projected,
            points.short,
            qualifying = false,
        ).takeIf { points.minimum != null || headlineTaken }
    val rows = parts + listOfNotNull(together)
    return rows.filter { it.met == false } + rows.filter { it.met != false }
}

internal fun writtenRows(points: MockPoints): List<WrittenPartPoints> =
    points.written.orEmpty().filter {
        it.range != null ||
            it.minimum != null
    }

internal fun hasTestRows(points: MockPoints?): Boolean =
    points != null && (testRows(points).isNotEmpty() || points.unjudged.isNotEmpty() || writtenRows(points).isNotEmpty())

/**
 * True when the mock exam checked at least one minimum and every one was reached. A written part's minimum is at
 * best likely reached, so a mock with one never says every minimum was.
 */
internal fun reachedEveryMinimum(points: MockPoints?): Boolean {
    val rows = points?.let(::testRows).orEmpty()
    return rows.any { it.met == true } && rows.none { it.met == false } && points?.written.orEmpty().none { it.minimum != null }
}

/** What the result leads with when a test's minimum is missed, instead of the score. */
internal class MissedMinimum(
    val title: String,
    val line: String,
)

@Composable
internal fun missedMinimum(points: MockPoints?): MissedMinimum? {
    val first = points?.let(::testRows)?.firstOrNull() ?: return null
    val minimum = first.minimum?.takeIf { first.met == false } ?: return null
    val needed = minimumText(minimum)
    val name = first.name
    return MissedMinimum(
        title =
            name?.let {
                stringResource(
                    R.string.mock_result_below_minimum_named,
                    it,
                )
            } ?: stringResource(R.string.mock_result_below_minimum),
        line =
            if (minimum.unit == PointsMinimum.Unit.PERCENT) {
                stringResource(R.string.mock_result_below_minimum_percent, percent(scorePercent(first)), needed)
            } else {
                val short = first.short ?: 0.0
                pointsText(
                    R.plurals.mock_result_below_minimum_points,
                    R.string.mock_result_below_minimum_points_decimal,
                    short,
                    points(short),
                    needed,
                )
            },
    )
}

/** Main's `MockResultPoints`: each test against its minimum, the whole exam's projection and the minimums it couldn't check. */
@Composable
internal fun PointsByTest(points: MockPoints) {
    val rows = testRows(points)
    val written = writtenRows(points)
    if (rows.isEmpty() && written.isEmpty() && points.unjudged.isEmpty()) return

    ResultSection(stringResource(R.string.mock_result_by_test)) {
        if (rows.isNotEmpty() || written.isNotEmpty()) {
            Column {
                rows.forEachIndexed { index, row ->
                    if (index > 0) HorizontalDivider()
                    TestRowItem(row)
                }
                written.forEachIndexed { index, part ->
                    if (rows.isNotEmpty() || index > 0) HorizontalDivider()
                    WrittenRowItem(part)
                }
            }
        }
        NoteLines(listOfNotNull(projectedLine(points)) + points.unjudged.map { unjudgedLine(it) })
    }
}

@Composable
private fun TestRowItem(row: TestRow) {
    val lines =
        listOfNotNull(
            row.minimum?.let { requirementLine(row, it) },
            stringResource(R.string.mock_result_qualifying).takeIf { row.qualifying },
        )

    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .padding(vertical = 12.dp)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                row.name ?: stringResource(R.string.mock_result_tests_together),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
            )
            if (lines.isNotEmpty()) {
                MarkedLine(
                    text = lines.factsLine(),
                    color = if (row.met == false) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                    icon = row.met?.let { if (it) R.drawable.ic_check else R.drawable.ic_close },
                )
            }
        }
        val total = points(row.max ?: row.asked)
        Text(
            row.projected?.let { stringResource(R.string.mock_result_about_points, points(it.roundToLong().toDouble()), total) }
                ?: stringResource(R.string.mock_result_points_of, points(row.earned), total),
            style = MaterialTheme.typography.labelLarge.withTabularFigures(),
        )
    }
}

@Composable
private fun WrittenRowItem(part: WrittenPartPoints) {
    val range = part.range
    val max = part.max
    val decimals = part.decimals?.toInt() ?: 0

    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .padding(vertical = 12.dp)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(part.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            if (range != null && max != null) {
                WrittenStandingLine(part)
            } else {
                Text(
                    listOfNotNull(
                        part.minimum?.let { requirementLine(it.toPointsMinimum()) },
                        stringResource(R.string.mock_result_written_no_estimate),
                    ).factsLine(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
        if (range != null && max != null) {
            Text(
                stringResource(R.string.mock_result_points_of, pointsRange(range.low, range.high, decimals), points(max)),
                style = MaterialTheme.typography.labelLarge.withTabularFigures(),
            )
        }
    }
}

private fun WrittenPartPointsMinimum.toPointsMinimum(): PointsMinimum =
    PointsMinimum(
        unit = if (unit == WrittenPartPointsMinimum.Unit.PERCENT) PointsMinimum.Unit.PERCENT else PointsMinimum.Unit.POINTS,
        value = value,
    )

@Composable
private fun requirementLine(
    row: TestRow,
    minimum: PointsMinimum,
): String {
    val needed = minimumText(minimum)
    val inPercent = minimum.unit == PointsMinimum.Unit.PERCENT

    return when (row.met) {
        false -> {
            if (inPercent) {
                stringResource(R.string.mock_result_below_percent, percent(scorePercent(row)), needed)
            } else {
                pluralPoints(R.plurals.mock_result_short_points, R.string.mock_result_short_points_decimal, row.short ?: 0.0, needed)
            }
        }

        true -> {
            if (inPercent) {
                stringResource(R.string.mock_result_reached_percent, needed)
            } else {
                pluralPoints(R.plurals.mock_result_reached_points, R.string.mock_result_reached_points_decimal, minimum.value)
            }
        }

        null -> {
            requirementLine(minimum)
        }
    }
}

@Composable
private fun requirementLine(minimum: PointsMinimum): String =
    if (minimum.unit == PointsMinimum.Unit.PERCENT) {
        stringResource(R.string.mock_result_needs_percent, minimumText(minimum))
    } else {
        pluralPoints(R.plurals.mock_result_needs_points, R.string.mock_result_needs_points_decimal, minimum.value)
    }

@Composable
private fun projectedLine(points: MockPoints): String? {
    val projected = points.projected ?: return null
    val max = points.max ?: return null
    return stringResource(R.string.mock_result_projected_total, points(projected.roundToLong().toDouble()), points(max))
}

@Composable
private fun unjudgedLine(entry: MockPointsUnjudgedInner): String {
    val minimum = entry.minimum
    val needed = minimumText(minimum)
    val inPercent = minimum.unit == PointsMinimum.Unit.PERCENT
    val name = entry.name

    return when {
        name == null && inPercent -> {
            stringResource(R.string.mock_result_unjudged_together_percent, needed)
        }

        name == null -> {
            pluralPoints(
                R.plurals.mock_result_unjudged_together_points,
                R.string.mock_result_unjudged_together_points_decimal,
                minimum.value,
            )
        }

        inPercent -> {
            stringResource(R.string.mock_result_unjudged_percent, name, needed)
        }

        else -> {
            pointsText(
                R.plurals.mock_result_unjudged_points,
                R.string.mock_result_unjudged_points_decimal,
                minimum.value,
                name,
                points(minimum.value),
            )
        }
    }
}

@Composable
private fun pluralPoints(
    plural: Int,
    decimal: Int,
    value: Double,
    vararg rest: String,
): String = pointsText(plural, decimal, value, points(value), *rest)

/** Polish gives decimals a form no whole number takes ("1,5 punktu"), which Android plurals can't pick. */
@Composable
internal fun pointsText(
    plural: Int,
    decimal: Int,
    value: Double,
    vararg arguments: String,
): String {
    val quantity =
        pluralQuantity((value * HUNDREDTHS).roundToLong() / HUNDREDTHS, currentLocale())
            ?: return stringResource(decimal, *arguments)
    return pluralStringResource(plural, quantity, *arguments)
}

@Composable
private fun points(value: Double): String = formatNumber(value, currentLocale())

@Composable
private fun percent(value: Double): String = formatPercent(value / WHOLE, currentLocale(), maximumFractionDigits = 1)

@Composable
private fun minimumText(minimum: PointsMinimum): String =
    if (minimum.unit == PointsMinimum.Unit.PERCENT) percent(minimum.value) else points(minimum.value)

private fun scorePercent(row: TestRow): Double = if (row.asked > 0) row.earned / row.asked * WHOLE else 0.0

private const val HUNDREDTHS = 100.0
private const val WHOLE = 100.0
