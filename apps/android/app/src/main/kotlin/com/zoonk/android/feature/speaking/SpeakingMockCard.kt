package com.zoonk.android.feature.speaking

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.StepState
import com.zoonk.android.feature.conversation.CallRequest
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.feature.conversation.CallStartModel
import com.zoonk.android.feature.conversation.OpenStartedCall
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.MarkedLine
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.api.models.SpeakingMockExam
import java.util.UUID

/**
 * Main's `SpeakingMockCard`: an IELTS or TOEFL speaking mock with an AI examiner, written on the
 * learner's tap and opened as a call; [from] is the conversation route's `from`.
 */
@Composable
fun SpeakingMockCard(
    exam: SpeakingMockExam,
    goalId: UUID,
    paused: Boolean,
    start: suspend (CallRequest) -> CallStart,
    open: (AppRoute) -> Unit,
    modifier: Modifier = Modifier,
    from: String? = null,
) {
    val model = viewModel(key = "speaking-mock:$goalId") { CallStartModel(start) }
    val startMock = { model.start(CallRequest.SpeakingMock(goalId)) }
    OpenStartedCall(model) { id -> open(AppRoute.Conversation(id.toString(), from = from)) }
    val writing = model.state == CallStartModel.State.Writing || model.state == CallStartModel.State.WriteFailed

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        MarkedLine(MaterialTheme.typography.titleSmall, mark = { KindDot(LearnKind.Conversation) }) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    stringResource(
                        if (exam ==
                            SpeakingMockExam.TOEFL
                        ) {
                            R.string.conversation_toefl_mock
                        } else {
                            R.string.conversation_ielts_mock
                        },
                    ),
                    Modifier.semantics { heading() },
                    style = MaterialTheme.typography.titleSmall,
                )
                Text(
                    stringResource(if (exam == SpeakingMockExam.TOEFL) R.string.speaking_mock_toefl else R.string.speaking_mock_ielts),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        when {
            paused -> {
                CallsPaused()
            }

            writing -> {
                val failed = model.state == CallStartModel.State.WriteFailed
                GenerationWait(
                    kind = GenerationKind.SpeakingMock,
                    run =
                        if (failed) {
                            GenerationRun(GenerationRun.Status.Failed, GenerationFailure.NotStarted)
                        } else {
                            GenerationRun(GenerationRun.Status.Following, steps = mapOf("writeMock" to StepState.Started))
                        },
                    onRetry = startMock,
                ) {
                    if (!failed) {
                        Text(
                            stringResource(R.string.speaking_mock_opens),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }

            else -> {
                val starting = model.state == CallStartModel.State.Starting
                OutlinedButton(onClick = startMock, enabled = !starting) {
                    Text(stringResource(if (starting) R.string.conversation_starting else R.string.speaking_mock_start))
                }
                if (model.state == CallStartModel.State.Failed) {
                    Text(
                        stringResource(R.string.speaking_mock_failed),
                        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }
    }
}
