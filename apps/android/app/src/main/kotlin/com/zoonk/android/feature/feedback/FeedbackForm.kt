package com.zoonk.android.feature.feedback

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.SessionState

/** Main's message to the team: the message, an email for the reply when there's no account, and Send. */
@Composable
fun FeedbackForm(
    app: AppContainer,
    target: FeedbackTarget,
    modifier: Modifier = Modifier,
    key: String = target.toString(),
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val accountEmail =
        (session as? SessionState.SignedIn)
            ?.takeUnless { it.isGuest }
            ?.account
            ?.user
            ?.email
    val form = viewModel(key = "feedback:$key") { FeedbackViewModel(app.feedback, target) }
    val isSending = form.status == FeedbackStatus.Sending

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
            value = form.message,
            onValueChange = form::onMessageChange,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 128.dp),
            label = { Text(stringResource(R.string.feedback_message)) },
            placeholder = { Text(stringResource(R.string.feedback_message_placeholder)) },
            supportingText = target.contentId?.let { { Text(stringResource(R.string.feedback_screen_attached)) } },
            readOnly = isSending,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
        )

        if (accountEmail == null) {
            OutlinedTextField(
                value = form.typedEmail,
                onValueChange = form::onEmailChange,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .semantics { contentType = ContentType.EmailAddress },
                label = { Text(stringResource(R.string.feedback_email)) },
                placeholder = { Text(stringResource(R.string.account_email_placeholder)) },
                singleLine = true,
                readOnly = isSending,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, autoCorrectEnabled = false),
            )
        }

        when (form.status) {
            FeedbackStatus.Sent -> {
                Line(stringResource(R.string.feedback_sent), MaterialTheme.colorScheme.onSurfaceVariant)
            }

            FeedbackStatus.Failed -> {
                Line(stringResource(R.string.feedback_failed), MaterialTheme.colorScheme.error)
            }

            FeedbackStatus.Idle, FeedbackStatus.Sending -> {}
        }

        Button(
            onClick = { form.send(accountEmail) },
            enabled = form.canSend(accountEmail),
            modifier = Modifier.align(Alignment.End),
        ) {
            Text(stringResource(R.string.feedback_send))
            if (isSending) {
                Spacer(Modifier.size(ButtonDefaults.IconSpacing))
                CircularProgressIndicator(Modifier.size(ButtonDefaults.IconSize), color = LocalContentColor.current, strokeWidth = 2.dp)
            }
        }
    }
}

@Composable
private fun Line(
    text: String,
    color: Color,
) {
    Text(
        text = text,
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = color,
        style = MaterialTheme.typography.bodyMedium,
    )
}

/**
 * "Report a problem" for a screen's overflow menu (main's item on every AI content page): call
 * [open] from the menu's item. The sheet it opens attaches [FeedbackTarget].
 */
@Stable
class ReportProblem internal constructor(
    private val show: () -> Unit,
) {
    fun open() = show()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun rememberReportProblem(
    app: AppContainer,
    target: FeedbackTarget,
): ReportProblem {
    var isOpen by rememberSaveable { mutableStateOf(false) }

    if (isOpen) {
        ModalBottomSheet(onDismissRequest = { isOpen = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
            Column(
                modifier =
                    Modifier
                        .padding(horizontal = 24.dp)
                        .padding(bottom = 24.dp)
                        .navigationBarsPadding(),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(
                    text = stringResource(R.string.feedback_report_problem),
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.titleLarge,
                )
                FeedbackForm(app, target)
            }
        }
    }

    return ReportProblem { isOpen = true }
}

/** The menu item that opens [report]; [onClick] closes the menu it's in. */
@Composable
fun ReportProblemItem(
    report: ReportProblem,
    onClick: () -> Unit,
) {
    DropdownMenuItem(
        text = { Text(stringResource(R.string.feedback_report_problem)) },
        leadingIcon = { Icon(painterResource(R.drawable.ic_flag), contentDescription = null) },
        onClick = {
            onClick()
            report.open()
        },
    )
}

/** A "More" button with only Report a problem, for a screen without a menu of its own. */
@Composable
fun ReportProblemMenu(
    app: AppContainer,
    target: FeedbackTarget,
) {
    val report = rememberReportProblem(app, target)
    var isOpen by rememberSaveable { mutableStateOf(false) }

    Box {
        IconButton(onClick = { isOpen = true }) {
            Icon(painterResource(R.drawable.ic_more_vert), contentDescription = stringResource(R.string.feedback_more))
        }
        DropdownMenu(expanded = isOpen, onDismissRequest = { isOpen = false }) {
            ReportProblemItem(report) { isOpen = false }
        }
    }
}
