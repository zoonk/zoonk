package com.zoonk.android.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationPhase
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.PhaseProgress
import com.zoonk.android.data.PhaseStatus
import com.zoonk.android.data.progress
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import kotlinx.coroutines.delay
import kotlin.math.exp
import kotlin.random.Random

/**
 * Main's `GenerationWait`: the run's phases with their times, a bar that drifts toward the end of
 * the running phase (never full before the work is), and what went wrong with its way out.
 * [onRetry] is null when there's no way out to offer.
 */
@Composable
fun GenerationWait(
    kind: GenerationKind,
    run: GenerationRun,
    onRetry: (() -> Unit)?,
    modifier: Modifier = Modifier,
    header: @Composable ColumnScope.() -> Unit = {},
) {
    val progress = kind.progress(run)
    val following = run.status == GenerationRun.Status.Waiting || run.status == GenerationRun.Status.Following
    val now by ticking(following)

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            header()

            val failure = run.failure.takeIf { run.status == GenerationRun.Status.Failed }
            if (failure != null) {
                GenerationFailureNotice(failure, onRetry)
            } else {
                WaitProgress(
                    name = stringResource(kind.label),
                    share = driftedShare(progress.share, progress.target, progress.activeMillis, following, now),
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            progress.phases.forEach { phase ->
                PhaseRow(
                    phase = phase,
                    following = following,
                    elapsedMillis = elapsed(phase, following, now, run.clockOffsetMillis),
                )
            }
        }
    }
}

@Composable
fun GenerationFailureNotice(
    failure: GenerationFailure,
    onRetry: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val (icon, title, description) =
        when (failure) {
            GenerationFailure.Connection -> {
                Triple(R.drawable.ic_wifi_off, R.string.generation_connection_lost, R.string.generation_connection_lost_description)
            }

            GenerationFailure.Generation -> {
                Triple(R.drawable.ic_error, R.string.generation_failed, R.string.generation_failed_description)
            }

            GenerationFailure.NotStarted -> {
                Triple(R.drawable.ic_error, R.string.generation_not_started, R.string.generation_not_started_description)
            }
        }

    OutlinedCard(modifier = modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite }) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(painterResource(icon), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(stringResource(title), style = MaterialTheme.typography.titleSmall)
                Text(
                    stringResource(description),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (onRetry != null) {
                    Button(onClick = onRetry, modifier = Modifier.padding(top = 8.dp)) {
                        Text(
                            stringResource(
                                if (failure ==
                                    GenerationFailure.Connection
                                ) {
                                    R.string.generation_reconnect
                                } else {
                                    R.string.generation_try_again
                                },
                            ),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun WaitProgress(
    name: String,
    share: Float,
) {
    val shown by animateFloatAsState(share, label = "generation progress")
    val percent = formatPercent(shown.toDouble(), currentLocale())

    Row(
        modifier =
            Modifier.clearAndSetSemantics {
                contentDescription = name
                progressBarRangeInfo = ProgressBarRangeInfo(shown, 0f..1f)
            },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Meter(share = shown, modifier = Modifier.weight(1f))
        Text(
            text = percent,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
        )
    }
}

@Composable
private fun PhaseRow(
    phase: PhaseProgress,
    following: Boolean,
    elapsedMillis: Long?,
) {
    val label = stringResource(phase.phase.label)
    val state =
        stringResource(
            when (phase.status) {
                PhaseStatus.Pending -> R.string.generation_phase_pending
                PhaseStatus.Active -> R.string.generation_phase_active
                PhaseStatus.Completed -> R.string.generation_phase_completed
                PhaseStatus.Failed -> R.string.generation_phase_failed
            },
        )
    val emphasized = phase.status == PhaseStatus.Active || phase.status == PhaseStatus.Failed

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        PhaseIndicator(phase.status)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = label,
                modifier =
                    Modifier.clearAndSetSemantics {
                        contentDescription = label
                        stateDescription = state
                        liveRegion = LiveRegionMode.Polite
                    },
                color = if (emphasized) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = if (emphasized) FontWeight.Medium else null,
                style = MaterialTheme.typography.bodyMedium,
            )
            if (phase.status == PhaseStatus.Active && following) DetailLine(phase.phase)
        }
        if (elapsedMillis != null) {
            Text(
                text = formatClock(elapsedMillis),
                modifier = Modifier.clearAndSetSemantics {},
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
        }
    }
}

@Composable
private fun PhaseIndicator(status: PhaseStatus) {
    val box =
        with(LocalDensity.current) {
            MaterialTheme.typography.bodyMedium.lineHeight
                .toDp()
        }
    val ink = MaterialTheme.colorScheme.onSurface
    val faint = MaterialTheme.colorScheme.onSurface.copy(alpha = FAINT_ALPHA)

    Box(Modifier.size(box), contentAlignment = Alignment.Center) {
        when (status) {
            PhaseStatus.Pending -> {
                Canvas(Modifier.size(box)) {
                    drawCircle(faint, radius = size.minDimension * DOT_SHARE / 2, style = Stroke(1.dp.toPx()))
                }
            }

            PhaseStatus.Active -> {
                Canvas(Modifier.size(box)) { drawCircle(ink, radius = size.minDimension * DOT_SHARE / 2) }
            }

            PhaseStatus.Completed -> {
                Icon(
                    painterResource(R.drawable.ic_check),
                    contentDescription = null,
                    modifier = Modifier.size(box * ICON_SHARE),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            PhaseStatus.Failed -> {
                Icon(
                    painterResource(R.drawable.ic_error),
                    contentDescription = null,
                    modifier = Modifier.size(box * ICON_SHARE),
                    tint = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

/** A line of what the phase is doing, changing every few seconds and then cycling. */
@Composable
private fun DetailLine(phase: GenerationPhase) {
    var tick by remember(phase.id) { mutableIntStateOf(0) }
    LaunchedEffect(phase.id) {
        while (true) {
            delay(Random.nextLong(DETAIL_MIN_MILLIS, DETAIL_MAX_MILLIS))
            tick++
        }
    }
    val line = detailLine(phase, tick) ?: return
    Text(
        text = line,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodySmall,
    )
}

@Composable
private fun detailLine(
    phase: GenerationPhase,
    tick: Int,
): String? {
    val lines = phase.lines.map { stringResource(it) }
    val numbered = phase.numbered
    val sequence =
        if (numbered == null) {
            lines
        } else {
            val review = stringResource(numbered.review)
            lines +
                (1..numbered.count).flatMap { number ->
                    val line = stringResource(numbered.line, number)
                    if (number % 2 == 0 && number < numbered.count) listOf(line, review) else listOf(line)
                }
        }
    if (tick < sequence.size) return sequence[tick]
    val loop = if (numbered != null) lines + stringResource(numbered.review) else lines
    return loop.takeIf { it.isNotEmpty() }?.let { it[(tick - sequence.size) % it.size] }
}

/** The device's clock each second while the run is followed, for the bar's drift and the running time. */
@Composable
private fun ticking(active: Boolean) =
    remember { mutableLongStateOf(System.currentTimeMillis()) }.also { now ->
        LaunchedEffect(active) {
            while (active) {
                now.longValue = System.currentTimeMillis()
                delay(TICK_MILLIS)
            }
        }
    }

/** Main's `useAnimatedProgress`: drifts from where the bar is when the work last moved, never backward unless the run restarted. */
@Composable
private fun driftedShare(
    share: Float,
    target: Float,
    activeMillis: Long?,
    following: Boolean,
    now: Long,
): Float {
    val drift = remember { Drift(shown = share, base = share, startedAt = now, share = share, target = target) }
    if (share != drift.share || target != drift.target) {
        drift.base = if (share < drift.share) share else maxOf(drift.shown, share)
        drift.startedAt = now
        drift.share = share
        drift.target = target
    }
    val ceiling = minOf(target, DRIFT_CAP)
    val constant = (activeMillis?.takeIf { it > 0 } ?: DEFAULT_ESTIMATE_MILLIS) / 2.0
    val drifted =
        when {
            !following -> share
            drift.base >= ceiling -> drift.base
            else -> drift.base + (ceiling - drift.base) * (1 - exp(-(now - drift.startedAt).coerceAtLeast(0) / constant)).toFloat()
        }
    return maxOf(drifted, share).also { drift.shown = it }
}

/** Not state: only the composition that reads it writes it. */
private class Drift(
    var shown: Float,
    var base: Float,
    var startedAt: Long,
    var share: Float,
    var target: Float,
)

private fun elapsed(
    phase: PhaseProgress,
    following: Boolean,
    now: Long,
    clockOffsetMillis: Long?,
): Long? {
    val startedAt = phase.startedAt ?: return null
    return when {
        phase.status == PhaseStatus.Completed && phase.endedAt != null -> phase.endedAt - startedAt
        phase.status == PhaseStatus.Active && following && clockOffsetMillis != null -> now - clockOffsetMillis - startedAt
        else -> null
    }?.coerceAtLeast(0)
}

/** Main's `formatClock`: "0:08", "1:02:03". */
internal fun formatClock(millis: Long): String {
    val total = (millis + 999) / 1000
    val hours = total / 3600
    val minutes = total / 60 % 60
    val seconds = total % 60
    return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, seconds) else "%d:%02d".format(minutes, seconds)
}

private const val TICK_MILLIS = 1000L
private const val DETAIL_MIN_MILLIS = 2200L
private const val DETAIL_MAX_MILLIS = 3600L

/** Estimates are never the finish line: only the end of the work shows a full bar. */
private const val DRIFT_CAP = 0.97f
private const val DEFAULT_ESTIMATE_MILLIS = 30_000L
private const val FAINT_ALPHA = 0.35f
