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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
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
import kotlinx.coroutines.flow.first
import java.util.UUID

/** Main's message to the team: the message, an email for the reply when there's no account, and Send. */
@Composable
fun FeedbackForm(
    app: AppContainer,
    form: FeedbackViewModel,
    modifier: Modifier = Modifier,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val accountEmail =
        (session as? SessionState.SignedIn)
            ?.takeUnless { it.isGuest }
            ?.account
            ?.user
            ?.email
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
            supportingText = form.target.contentId?.let { { Text(stringResource(R.string.feedback_screen_attached)) } },
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

/** Main's feedback dialog as a sheet: [open] shows it, and a sent message closes it with thanks. */
@Stable
class FeedbackSheet internal constructor(
    private val show: () -> Unit,
) {
    fun open() = show()
}

/** "Report a problem" for a screen's overflow menu (main's item on every AI content page), attaching [target]. */
@Composable
fun rememberReportProblem(
    app: AppContainer,
    target: FeedbackTarget,
): FeedbackSheet = rememberFeedbackSheet(app, target, app.feedback, isReport = true)

@Composable
fun rememberSendFeedback(
    app: AppContainer,
    screen: String,
    sender: FeedbackSender = app.feedback,
): FeedbackSheet = rememberFeedbackSheet(app, FeedbackTarget(screen), sender, isReport = false)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun rememberFeedbackSheet(
    app: AppContainer,
    target: FeedbackTarget,
    sender: FeedbackSender,
    isReport: Boolean,
): FeedbackSheet {
    // Each opening is a new message, as main's dialog is, and a slow send closes only its own.
    var opening by rememberSaveable { mutableStateOf<String?>(null) }

    opening?.let { id ->
        val form = viewModel(key = "feedback:$id") { FeedbackViewModel(sender, target) }

        LaunchedEffect(form) {
            snapshotFlow { form.status }.first { it == FeedbackStatus.Sent }
            if (opening == id) opening = null
            app.snackbars.show(R.string.feedback_thanks)
        }

        if (form.status != FeedbackStatus.Sent) {
            ModalBottomSheet(
                onDismissRequest = { opening = null },
                sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            ) {
                Column(
                    modifier =
                        Modifier
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 24.dp)
                            .padding(bottom = 24.dp)
                            .navigationBarsPadding(),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = stringResource(if (isReport) R.string.feedback_report_problem else R.string.feedback_send_feedback),
                            modifier = Modifier.semantics { heading() },
                            style = MaterialTheme.typography.titleLarge,
                        )
                        if (!isReport) {
                            Text(
                                text = stringResource(R.string.feedback_send_feedback_description),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }
                    FeedbackForm(app, form)
                }
            }
        }
    }

    return remember { FeedbackSheet { opening = UUID.randomUUID().toString() } }
}

/** The menu item that opens [report]; [onClick] closes the menu it's in. */
@Composable
fun ReportProblemItem(
    report: FeedbackSheet,
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
