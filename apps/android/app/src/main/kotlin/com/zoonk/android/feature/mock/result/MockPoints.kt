package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.pluralQuantity
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.MockPoints
import com.zoonk.api.models.MockPointsUnjudgedInner
import com.zoonk.api.models.PointsMinimum
import kotlin.math.roundToLong

/** A test of the exam, or its objective tests together when [name] is null. */
private data class TestRow(
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

/** Misses first, so what would eliminate the learner is read before what went fine. */
private fun testRows(points: MockPoints): List<TestRow> {
    val parts =
        points.parts.map {
            TestRow(it.name, it.asked, it.earned, it.max, it.met, it.minimum, it.projected, it.short, it.qualifying)
        }
    val together =
        points.minimum?.let {
            TestRow(null, points.asked, points.earned, points.max, points.met, it, points.projected, points.short, qualifying = false)
        }
    val rows = parts + listOfNotNull(together)
    return rows.filter { it.met == false } + rows.filter { it.met != false }
}

/** Main's `MockResultPoints`: the verdict a full mock can give, each test against its minimum, and the minimums it couldn't check. */
@Composable
internal fun PointsByTest(points: MockPoints) {
    val rows = testRows(points)
    if (rows.isEmpty() && points.unjudged.isEmpty()) return

    ResultSection(stringResource(R.string.mock_result_by_test)) {
        Verdict(rows)
        NoteLines(listOfNotNull(projectedLine(points)))
        if (rows.isNotEmpty()) {
            Column {
                rows.forEachIndexed { index, row ->
                    if (index > 0) HorizontalDivider()
                    TestRowItem(row)
                }
            }
        }
        NoteLines(points.unjudged.map { unjudgedLine(it) })
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
                    met = row.met,
                    color = if (row.met == false) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
        Text(
            stringResource(R.string.mock_result_points_of, points(row.projected ?: row.earned), points(row.max ?: row.asked)),
            style = MaterialTheme.typography.labelLarge.withTabularFigures(),
        )
    }
}

@Composable
private fun Verdict(rows: List<TestRow>) {
    if (rows.none { it.met != null }) return
    val first = rows.first()
    val minimum = first.minimum
    val style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium)

    if (first.met == false && minimum != null) {
        MarkedLine(missSentence(first, minimum), met = false, color = MaterialTheme.colorScheme.error, style = style)
    } else {
        MarkedLine(
            stringResource(R.string.mock_result_meets_minimums),
            met = true,
            color = MaterialTheme.colorScheme.onSurface,
            style = style,
        )
    }
}

/** A line led by a check when [met] or a cross when not, so a miss reads in words and shape, not only in color. */
@Composable
private fun MarkedLine(
    text: String,
    met: Boolean?,
    color: Color,
    style: TextStyle,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        met?.let {
            Icon(
                painterResource(if (it) R.drawable.ic_check else R.drawable.ic_close),
                contentDescription = null,
                modifier = Modifier.size(with(LocalDensity.current) { style.lineHeight.toDp() }),
                tint = color,
            )
        }
        Text(text, color = color, style = style)
    }
}

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
                pluralPoints(R.plurals.mock_result_short_points, row.short ?: 0.0, needed)
            }
        }

        true -> {
            if (inPercent) {
                stringResource(R.string.mock_result_reached_percent, needed)
            } else {
                pluralPoints(R.plurals.mock_result_reached_points, minimum.value)
            }
        }

        null -> {
            if (inPercent) {
                stringResource(R.string.mock_result_needs_percent, needed)
            } else {
                pluralPoints(R.plurals.mock_result_needs_points, minimum.value)
            }
        }
    }
}

@Composable
private fun missSentence(
    row: TestRow,
    minimum: PointsMinimum,
): String {
    val needed = minimumText(minimum)
    val inPercent = minimum.unit == PointsMinimum.Unit.PERCENT
    val short = row.short ?: 0.0
    val name = row.name

    return when {
        name == null && inPercent -> {
            stringResource(R.string.mock_result_eliminated_together_percent, percent(scorePercent(row)), needed)
        }

        name == null -> {
            pluralPoints(R.plurals.mock_result_eliminated_together_points, short, needed)
        }

        inPercent -> {
            stringResource(R.string.mock_result_eliminated_percent, name, percent(scorePercent(row)), needed)
        }

        else -> {
            pluralStringResource(R.plurals.mock_result_eliminated_points, quantity(short), name, points(short), needed)
        }
    }
}

@Composable
private fun projectedLine(points: MockPoints): String? {
    val projected = points.projected
    val max = points.max
    return when {
        projected != null && max != null -> stringResource(R.string.mock_result_projected_total, points(projected), points(max))
        projected != null || points.parts.any { it.projected != null } -> stringResource(R.string.mock_result_projected_tests)
        else -> null
    }
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
            pluralPoints(R.plurals.mock_result_unjudged_together_points, minimum.value)
        }

        inPercent -> {
            stringResource(R.string.mock_result_unjudged_percent, name, needed)
        }

        else -> {
            pluralStringResource(R.plurals.mock_result_unjudged_points, quantity(minimum.value), name, points(minimum.value))
        }
    }
}

@Composable
private fun pluralPoints(
    id: Int,
    value: Double,
    vararg rest: String,
): String = pluralStringResource(id, quantity(value), points(value), *rest)

@Composable
private fun quantity(value: Double): Int {
    val rounded = (value * HUNDREDTHS).roundToLong() / HUNDREDTHS
    return pluralQuantity(rounded, currentLocale()) ?: rounded.toInt()
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
