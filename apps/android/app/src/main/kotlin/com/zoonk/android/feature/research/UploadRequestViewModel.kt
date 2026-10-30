package com.zoonk.android.feature.research

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.SavedStateHandleSaveableApi
import androidx.lifecycle.viewmodel.compose.saveable
import com.zoonk.android.feature.onboarding.AttachedSource
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.PickedFile
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.start.AttachDraft
import com.zoonk.api.models.GoalUploadRequestRequest
import kotlinx.coroutines.launch
import java.util.UUID

internal enum class UploadWork { Attaching, Sending, Dismissing }

/** What the learner did with the ask on one visit to Today; the next visit shows the ask as Today reads it. */
internal data class UploadAnswer(
    val visit: Int,
    val uploading: Boolean = false,
    val answered: GoalUploadRequestRequest? = null,
    val dismissed: Boolean = false,
    val attachFailure: WriteOutcome<*>? = null,
    val saveFailed: Boolean = false,
)

@OptIn(SavedStateHandleSaveableApi::class)
internal class UploadRequestViewModel(
    private val store: OnboardingStore,
    private val goalId: UUID,
    handle: SavedStateHandle,
) : ViewModel() {
    private var answer by mutableStateOf(UploadAnswer(visit = -1))

    var work by mutableStateOf<UploadWork?>(null)
        private set

    /** Kept here so the words typed survive the ask moving between the sheet and the panel beside Today. */
    val draft = handle.saveable(key = "draft", saver = AttachDraft.Saver) { AttachDraft() }

    fun on(visit: Int) = answer.takeIf { it.visit == visit } ?: UploadAnswer(visit)

    fun upload(visit: Int) = update(visit) { it.copy(uploading = true) }

    fun dismiss(visit: Int) {
        if (work != null) return
        work = UploadWork.Dismissing
        update(visit) { it.copy(saveFailed = false) }
        viewModelScope.launch {
            when (store.dismissUploadRequest(goalId)) {
                is WriteOutcome.Done -> {
                    update(visit) { it.copy(dismissed = true) }
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    update(visit) { it.copy(saveFailed = true) }
                }
            }
            work = null
        }
    }

    fun attachFile(
        visit: Int,
        request: GoalUploadRequestRequest,
        file: PickedFile,
    ) = send(visit, request) { store.attachFile(file, request.language, goalId) }

    fun attachText(
        visit: Int,
        request: GoalUploadRequestRequest,
        text: String,
    ) = send(visit, request) { store.attachText(text, request.language, goalId) }

    fun attachLink(
        visit: Int,
        request: GoalUploadRequestRequest,
        url: String,
    ) = send(visit, request) { store.attachLink(url, request.language, goalId) }

    private fun send(
        visit: Int,
        request: GoalUploadRequestRequest,
        attach: suspend () -> WriteOutcome<AttachedSource>,
    ) {
        if (work != null) return
        work = UploadWork.Attaching
        update(visit) { it.copy(attachFailure = null, saveFailed = false) }
        viewModelScope.launch {
            when (val attached = attach()) {
                is WriteOutcome.Done -> {
                    work = UploadWork.Sending
                    when (store.answerUploadRequest(goalId, listOf(attached.value.id))) {
                        is WriteOutcome.Done -> {
                            draft.clear()
                            update(visit) { it.copy(answered = request) }
                        }

                        WriteOutcome.Obsolete -> {}

                        else -> {
                            update(visit) { it.copy(saveFailed = true) }
                        }
                    }
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    update(visit) { it.copy(attachFailure = attached) }
                }
            }
            work = null
        }
    }

    /** A save that ends after the learner left Today belongs to no visit they can see. */
    private fun update(
        visit: Int,
        change: (UploadAnswer) -> UploadAnswer,
    ) {
        if (visit < answer.visit) return
        answer = change(on(visit))
    }
}
