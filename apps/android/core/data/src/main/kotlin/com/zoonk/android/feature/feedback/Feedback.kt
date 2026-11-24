package com.zoonk.android.feature.feedback

import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.clearText
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.SavedStateHandleSaveableApi
import androidx.lifecycle.viewmodel.compose.saveable
import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.BuildConfig
import com.zoonk.android.data.SessionSource
import com.zoonk.android.data.perform
import com.zoonk.api.models.FeedbackSubmission
import com.zoonk.api.models.FeedbackSubmissionContext
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

/** What a report is about, attached so the team sees the screen the learner saw. */
data class FeedbackTarget(
    val screen: String,
    val contentKind: FeedbackSubmissionContext.ContentKind? = null,
    val contentId: UUID? = null,
    val reportType: FeedbackSubmissionContext.ReportType? = null,
)

fun interface FeedbackApi {
    suspend fun send(
        session: AuthenticatedSession?,
        submission: FeedbackSubmission,
    )
}

class LiveFeedbackApi(
    private val api: ApiClients,
) : FeedbackApi {
    override suspend fun send(
        session: AuthenticatedSession?,
        submission: FeedbackSubmission,
    ) {
        perform { api.clients(session).feedback.createFeedback(submission) }
    }
}

class FeedbackSender(
    private val api: FeedbackApi,
    private val sessions: SessionSource,
) {
    suspend fun send(
        target: FeedbackTarget,
        email: String?,
        message: String,
    ): Boolean =
        try {
            val context =
                FeedbackSubmissionContext(
                    appVersion = BuildConfig.VERSION_NAME,
                    contentId = target.contentId,
                    contentKind = target.contentKind,
                    platform = FeedbackSubmissionContext.Platform.ANDROID,
                    screen = target.screen,
                    reportType = target.reportType,
                )
            api.send(
                sessions.current,
                FeedbackSubmission(email = email?.trim()?.takeIf(String::isNotEmpty), message = message, context = context),
            )
            true
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            false
        }
}

const val MAX_FEEDBACK_MESSAGE_LENGTH = 5_000

enum class FeedbackStatus { Idle, Sending, Sent, Failed }

@OptIn(SavedStateHandleSaveableApi::class)
class FeedbackViewModel(
    private val sender: FeedbackSender,
    val target: FeedbackTarget,
    initialMessage: String = "",
    handle: SavedStateHandle,
) : ViewModel() {
    val messageField = handle.saveable(key = "message", saver = TextFieldState.Saver) { TextFieldState(initialMessage) }
    val emailField = handle.saveable(key = "email", saver = TextFieldState.Saver) { TextFieldState() }
    val message get() = messageField.text.toString()
    private val typedEmail get() = emailField.text.toString()
    private var result by mutableStateOf(FeedbackStatus.Idle)
    private var resultFor by mutableStateOf<Pair<String, String>?>(null)
    val status get() = if (resultFor == null || resultFor == (message to typedEmail)) result else FeedbackStatus.Idle

    /** [accountEmail] is the signed-in account's; without one the learner types it. */
    fun canSend(accountEmail: String?): Boolean {
        val email = typedEmail.trim()
        val validEmail =
            when {
                accountEmail != null -> {
                    accountEmail.isNotBlank()
                }

                email.isEmpty() -> {
                    target.reportType == FeedbackSubmissionContext.ReportType.SAVE_FAILURE
                }

                else -> {
                    email.matches(
                        Regex("""^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$"""),
                    )
                }
            }
        return status != FeedbackStatus.Sending && message.isNotBlank() && validEmail
    }

    fun send(accountEmail: String?) {
        if (!canSend(accountEmail)) return
        val email = (accountEmail ?: typedEmail).trim()
        val submitted = message
        resultFor = null
        result = FeedbackStatus.Sending
        viewModelScope.launch {
            val sent = sender.send(target, email, submitted.trim())
            if (sent) messageField.clearText()
            resultFor = message to typedEmail
            result = if (sent) FeedbackStatus.Sent else FeedbackStatus.Failed
        }
    }
}
