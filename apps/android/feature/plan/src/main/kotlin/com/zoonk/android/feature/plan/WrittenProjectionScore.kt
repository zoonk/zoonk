package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.goalcontent.WriteNow
import com.zoonk.android.feature.writing.PointsReadout
import com.zoonk.android.feature.writing.PointsValue
import com.zoonk.android.feature.writing.RangeMeter
import com.zoonk.android.feature.writing.formatPoints
import com.zoonk.android.feature.writing.minimumShare
import com.zoonk.android.feature.writing.pointsRange
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.WritingRangeOutput
import com.zoonk.api.models.WrittenPartPoints
import com.zoonk.api.models.WrittenPartPointsMinimum
import com.zoonk.api.models.WrittenProjection
import kotlin.math.abs

/**
 * The exam's projected score with its written part: a total once every part is measured, the part
 * still missing or below its own minimum otherwise. Never 0, never the objective's percent copied.
 */
@Composable
internal fun WrittenProjectionScore(
    projection: WrittenProjection,
    source: String?,
    writeNow: WriteNow?,
) {
    val below = projection.parts.firstOrNull { it.standing == WrittenPartPoints.Standing.BELOW }
    // A part graded by level has no points to wait for, so the headline doesn't say it's waiting.
    val unmeasured =
        projection.parts.firstOrNull { it.inPoints() && (it.standing == WrittenPartPoints.Standing.UNMEASURED || it.range == null) }
    val combined = projection.combined
    val max = projection.max

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                stringResource(R.string.plan_estimated_score),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            when {
                below != null -> {
                    Text(stringResource(R.string.plan_written_below_minimum), style = MaterialTheme.typography.titleLarge)
                    below.minimum?.let {
                        val locale = currentLocale()
                        MetaLine(
                            if (it.unit == WrittenPartPointsMinimum.Unit.PERCENT) {
                                stringResource(R.string.plan_written_asks_for_share, below.name, formatPercent(it.value / PERCENT, locale))
                            } else {
                                stringResource(R.string.plan_written_asks_for, below.name, formatPoints(it.value, locale))
                            },
                        )
                    }
                }

                unmeasured != null -> {
                    MetaLine(notMeasuredLine(unmeasured, max))
                }

                combined != null && max != null -> {
                    PointsReadout(combined.low, combined.high, max, decimals = 0)
                }
            }
        }

        Column {
            ScoreRow(stringResource(R.string.plan_written_objective), projection.objective, projection.objectiveMax) {
                if (projection.objective != null) source?.let { MetaLine(it) }
            }
            projection.parts.forEach { part ->
                HorizontalDivider()
                ScoreRow(
                    part.name,
                    part.range,
                    part.max,
                    minimumShare = part.minimum?.let { minimumShare(it.unit == WrittenPartPointsMinimum.Unit.PERCENT, it.value, part.max) },
                    decimals = part.decimals?.toInt(),
                    levels = !part.inPoints(),
                ) { Standing(part) }
            }
        }

        if ((below != null || unmeasured != null) && writeNow != null) {
            Button(onClick = { writeNow.write(null) }, modifier = Modifier.fillMaxWidth(), busy = writeNow.busy) {
                Text(stringResource(R.string.essay_write))
            }
        }
    }
}

/** A server from before `scale` says a part is in points by having measured it in points. */
private fun WrittenPartPoints.inPoints(): Boolean = scale?.let { it == WrittenPartPoints.Scale.POINTS } ?: (range != null)

/** The part still to measure, with its share of the final score when the projection knows it. */
@Composable
private fun notMeasuredLine(
    part: WrittenPartPoints,
    max: Double?,
): String {
    val share = part.max?.let { partMax -> max?.takeIf { it > 0 }?.let { partMax / it } }
    return when {
        share == null -> stringResource(R.string.plan_written_not_measured, part.name)
        abs(share - HALF) < SHARE_SLACK -> stringResource(R.string.plan_written_not_measured_half, part.name)
        else -> stringResource(R.string.plan_written_not_measured_share, part.name, formatPercent(share, currentLocale()))
    }
}

@Composable
private fun ScoreRow(
    name: String,
    range: WritingRangeOutput?,
    max: Double?,
    minimumShare: Double? = null,
    decimals: Int? = null,
    /** Graded by level: no points to wait for, so no meter holds their place. */
    levels: Boolean = false,
    below: @Composable () -> Unit = {},
) {
    Column(Modifier.padding(vertical = 12.dp).semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(name, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
            PointsValue(range?.low, range?.high, max, decimals = decimals, levels = levels)
        }
        if (!(levels && range == null)) max?.let { RangeMeter(range?.low, range?.high, it, minimumShare = minimumShare) }
        below()
    }
}

/** Said against the part's own minimum, never the objective's: 50 of 100 on the sum of its answers. */
@Composable
private fun Standing(part: WrittenPartPoints) {
    val minimum = part.minimum?.value ?: return
    val range = part.range ?: return
    val locale = currentLocale()
    val points = formatPoints(minimum, locale)
    val decimals = part.decimals?.toInt()

    when (part.standing) {
        WrittenPartPoints.Standing.MET -> {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(painterResource(R.drawable.ic_check), null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.tertiary)
                MetaLine(stringResource(R.string.plan_written_above_minimum, points))
            }
        }

        WrittenPartPoints.Standing.BELOW -> {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(painterResource(R.drawable.ic_close), null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.error)
                Text(
                    stringResource(
                        R.string.plan_written_points_below,
                        pointsRange(minimum - range.high, minimum - range.low, decimals),
                        points,
                    ),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        WrittenPartPoints.Standing.OVERLAPS -> {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(painterResource(R.drawable.ic_warning), null, Modifier.size(14.dp), tint = MaterialTheme.zoonk.warningText)
                Text(
                    stringResource(R.string.plan_written_close_to_minimum, points),
                    color = MaterialTheme.zoonk.warningText,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        WrittenPartPoints.Standing.UNMEASURED, null -> {}
    }
}

private const val PERCENT = 100.0
private const val HALF = 0.5
private const val SHARE_SLACK = 1e-6
