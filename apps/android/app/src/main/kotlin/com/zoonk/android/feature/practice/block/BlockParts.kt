package com.zoonk.android.feature.practice.block

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.feature.player.SessionStep
import com.zoonk.android.feature.practice.NoteText
import com.zoonk.android.feature.questions.NoteRow

@Composable
internal fun PauseSuggestion(viewModel: QuestionBlockViewModel) {
    val move by viewModel.sessionMove.collectAsStateWithLifecycle()

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        NoteRow(R.drawable.ic_local_cafe) { NoteText(stringResource(R.string.practice_pause_text)) }
        FilledTonalButton(onClick = viewModel::stopSession, enabled = !move.busy) {
            Text(stringResource(R.string.practice_pause_stop))
        }
        if (move.failed == SessionStep.Stop) {
            Text(
                text = stringResource(R.string.practice_pause_failed),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

/** A fully answered block waits for Finish: finishing can prepare the rest of the day. */
@Composable
internal fun FinishReady() {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = stringResource(R.string.practice_finish_ready_title),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.headlineSmall,
        )
        Text(
            text = stringResource(R.string.practice_finish_ready_detail),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyLarge,
        )
    }
}
