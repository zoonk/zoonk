package com.zoonk.android.feature.research

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.start.AttachControls
import com.zoonk.android.feature.onboarding.start.attachErrorMessage
import com.zoonk.android.ui.components.Suggestion
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.android.ui.components.SuggestionHeader
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.components.SuggestionMark
import com.zoonk.android.ui.components.SuggestionOpen
import com.zoonk.android.ui.components.SuggestionResult
import com.zoonk.android.ui.components.SuggestionSaveError
import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.GoalUploadRequestRequest
import java.util.UUID

/**
 * What research asked to upload for a goal. Uploading starts research with the document, which
 * rebuilds the plan minutes later; "Not now" removes the ask for good.
 */
@Composable
internal fun UploadRequestNotice(
    goalId: UUID,
    request: GoalUploadRequestRequest?,
    store: OnboardingStore,
    layout: SuggestionLayout,
    modifier: Modifier = Modifier,
) {
    val vm = viewModel(key = "upload-request-$goalId") { UploadRequestViewModel(store, goalId) }
    val shown = vm.answered ?: request
    if (shown == null || vm.dismissed) return

    val copy = requestCopy(shown)
    val thanks = stringResource(R.string.research_upload_thanks)
    val answered = vm.answered != null
    val idle = vm.work == null

    Suggestion(
        label = stringResource(R.string.research_upload_label),
        summary = if (answered) thanks else copy.title,
        layout = layout,
        modifier = modifier,
        mark = SuggestionMark.Symbol(R.drawable.ic_document_search),
        answered = answered,
        lineAction = if (answered) null else ({ SuggestionOpen(stringResource(R.string.research_upload_open)) }),
    ) {
        if (answered) {
            SuggestionResult(thanks)
        } else {
            SuggestionHeader(copy.title)
            SuggestionDescription(copy.body)
            if (vm.isUploading) {
                AttachControls(
                    pending = !idle,
                    error = vm.attachFailure?.let { attachErrorMessage(it) },
                    onFile = { vm.attachFile(shown, it) },
                    onText = { vm.attachText(shown, it) },
                    onLink = { vm.attachLink(shown, it) },
                    pendingText = if (vm.work == UploadWork.Sending) stringResource(R.string.research_upload_sending) else null,
                )
            } else {
                SuggestionActions {
                    SuggestionAction(
                        onClick = {
                            vm.upload()
                            focus()
                        },
                        enabled = idle,
                    ) {
                        Icon(painterResource(R.drawable.ic_upload), contentDescription = null, Modifier.size(ButtonDefaults.IconSize))
                        Spacer(Modifier.size(ButtonDefaults.IconSpacing))
                        Text(copy.action)
                    }
                    SuggestionAction(stringResource(R.string.research_not_now), vm::dismiss, enabled = idle, secondary = true)
                }
            }
        }
        if (vm.saveFailed) SuggestionSaveError()
    }
}

/** A change to a source the goal follows, such as a new notice. */
@Composable
internal fun SourceChangeNotice(
    message: String,
    layout: SuggestionLayout,
    modifier: Modifier = Modifier,
) {
    val label = stringResource(R.string.research_change_label)

    Suggestion(
        label = label,
        summary = message,
        layout = layout,
        modifier = modifier,
        mark = SuggestionMark.Symbol(R.drawable.ic_history),
    ) {
        SuggestionHeader(label)
        SuggestionDescription(message)
    }
}

private class RequestCopy(
    val title: String,
    val body: String,
    val action: String,
)

@Composable
private fun requestCopy(request: GoalUploadRequestRequest): RequestCopy {
    val notice = request.examDocument == ExamDocument.NOTICE

    return when {
        request.reason == GoalUploadRequestRequest.Reason.CLASS_MATERIAL -> {
            RequestCopy(
                stringResource(R.string.research_class_title),
                stringResource(R.string.research_class_body),
                stringResource(R.string.research_class_action),
            )
        }

        request.goalKind != GoalUploadRequestRequest.GoalKind.EXAM -> {
            RequestCopy(
                stringResource(R.string.research_source_title),
                stringResource(R.string.research_source_body),
                stringResource(R.string.research_source_action),
            )
        }

        request.reason == GoalUploadRequestRequest.Reason.UNVERIFIED -> {
            RequestCopy(
                stringResource(R.string.research_unverified_title),
                stringResource(if (notice) R.string.research_unverified_notice_body else R.string.research_unverified_guide_body),
                stringResource(if (notice) R.string.research_notice_action else R.string.research_guide_action),
            )
        }

        else -> {
            RequestCopy(
                stringResource(if (notice) R.string.research_notice_title else R.string.research_guide_title),
                stringResource(if (notice) R.string.research_notice_body else R.string.research_guide_body),
                stringResource(if (notice) R.string.research_notice_action else R.string.research_guide_action),
            )
        }
    }
}
