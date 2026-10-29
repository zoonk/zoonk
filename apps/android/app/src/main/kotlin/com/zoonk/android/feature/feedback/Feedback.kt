package com.zoonk.android.feature.feedback

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.BuildConfig
import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
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

/** Sends a message to the team, as anyone: a visitor gives an email for the reply. */
class FeedbackSender(
    private val api: FeedbackApi,
    private val sessions: SessionSource,
) {
    suspend fun send(
        target: FeedbackTarget,
        email: String,
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
                )
            api.send(sessions.current, FeedbackSubmission(email = email, message = message, context = context))
            true
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            false
        }
}

enum class FeedbackStatus { Idle, Sending, Sent, Failed }

class FeedbackViewModel(
    private val sender: FeedbackSender,
    private val target: FeedbackTarget,
) : ViewModel() {
    var message by mutableStateOf("")
        private set
    var typedEmail by mutableStateOf("")
        private set
    var status by mutableStateOf(FeedbackStatus.Idle)
        private set

    fun onMessageChange(value: String) {
        message = value
        if (status != FeedbackStatus.Sending) status = FeedbackStatus.Idle
    }

    fun onEmailChange(value: String) {
        typedEmail = value
        if (status != FeedbackStatus.Sending) status = FeedbackStatus.Idle
    }

    /** [accountEmail] is the signed-in account's; without one the learner types it. */
    fun canSend(accountEmail: String?): Boolean =
        status != FeedbackStatus.Sending && message.isNotBlank() && (accountEmail ?: typedEmail).isNotBlank()

    fun send(accountEmail: String?) {
        if (!canSend(accountEmail)) return
        val email = (accountEmail ?: typedEmail).trim()
        status = FeedbackStatus.Sending
        viewModelScope.launch {
            val sent = sender.send(target, email, message.trim())
            status = if (sent) FeedbackStatus.Sent else FeedbackStatus.Failed
            if (sent) message = ""
        }
    }
}
