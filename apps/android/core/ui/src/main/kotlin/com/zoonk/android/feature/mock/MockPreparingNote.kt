package com.zoonk.android.feature.mock

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.PhaseStatus
import com.zoonk.android.data.progress
import com.zoonk.android.feature.subscription.GateWords
import com.zoonk.android.ui.components.GenerationProgressBar
import com.zoonk.android.ui.components.rememberGenerationProgress
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatDuration
import kotlinx.coroutines.CoroutineScope
import kotlin.math.ceil

private const val SECONDS_PER_MINUTE = 60

/**
 * Main's `MockPreparingNote`: a mock being prepared, over the buttons where Start goes. It follows
 * the run writing the learner's paper, its bar and about how long is left; with nothing writing it
 * (what was written fell short, or the run stopped), the daily preparation goes on with it, so the
 * note says to come back. [onWritten] reads the screen again, which then offers Start.
 */
@Composable
fun MockPreparingNote(
    title: String,
    createWait: (CoroutineScope) -> MockPaperWait,
    onWritten: suspend () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val wait = remember { createWait(scope) }
    val run by wait.run.collectAsStateWithLifecycle()
    val idle by wait.idle.collectAsStateWithLifecycle()
    val written by rememberUpdatedState(onWritten)

    DisposableEffect(wait) {
        wait.start()
        onDispose { wait.stop() }
    }

    LaunchedEffect(run.status) {
        if (run.status == GenerationRun.Status.Ready) written()
    }

    if (idle || run.status == GenerationRun.Status.Failed) {
        GateWords(title = title, line = stringResource(R.string.mock_preparing_line))
    } else {
        MockWritingProgress(title, run)
    }
}

@Composable
private fun MockWritingProgress(
    title: String,
    run: GenerationRun,
) {
    val kind = GenerationKind.MockPaper
    val share = rememberGenerationProgress(kind, run)
    val progress = kind.progress(run)
    val step = progress.phases.firstOrNull { it.status == PhaseStatus.Active }?.let { stringResource(it.phase.label) }
    val seconds = progress.phases.sumOf { it.phase.seconds } * (1 - share)
    val minutes = ceil(seconds / SECONDS_PER_MINUTE).toLong().coerceAtLeast(1)
    val left = stringResource(R.string.mock_writing_time_left, formatDuration(minutes * SECONDS_PER_MINUTE, currentLocale()))
    val line = if (run.status == GenerationRun.Status.Ready) stringResource(R.string.mock_writing_done) else listOf(step, left).factsLine()

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = MaterialTheme.typography.titleSmall)
        // The bar's note is a live region: TalkBack hears the line as it changes (a step, a minute), not every tick of the bar.
        Column(
            Modifier.clearAndSetSemantics { contentDescription = line },
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            GenerationProgressBar(kind, run, share)
            Text(line, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
