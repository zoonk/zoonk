package com.zoonk.android.feature.research

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.feature.onboarding.AttachedSource
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.PickedFile
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.api.models.GoalUploadRequestRequest
import kotlinx.coroutines.launch
import java.util.UUID

internal enum class UploadWork { Attaching, Sending, Dismissing }

internal class UploadRequestViewModel(
    private val store: OnboardingStore,
    private val goalId: UUID,
) : ViewModel() {
    /** The ask as the learner answered it, which keeps thanking them while Today reads it gone. */
    var answered by mutableStateOf<GoalUploadRequestRequest?>(null)
        private set

    var dismissed by mutableStateOf(false)
        private set

    var isUploading by mutableStateOf(false)
        private set

    var work by mutableStateOf<UploadWork?>(null)
        private set

    var attachFailure by mutableStateOf<WriteOutcome<*>?>(null)
        private set

    var saveFailed by mutableStateOf(false)
        private set

    fun upload() {
        isUploading = true
    }

    fun dismiss() {
        if (work != null) return
        work = UploadWork.Dismissing
        saveFailed = false
        viewModelScope.launch {
            when (store.dismissUploadRequest(goalId)) {
                is WriteOutcome.Done -> {
                    dismissed = true
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    saveFailed = true
                }
            }
            work = null
        }
    }

    fun attachFile(
        request: GoalUploadRequestRequest,
        file: PickedFile,
    ) = send(request) { store.attachFile(file, request.language, goalId) }

    fun attachText(
        request: GoalUploadRequestRequest,
        text: String,
    ) = send(request) { store.attachText(text, request.language, goalId) }

    fun attachLink(
        request: GoalUploadRequestRequest,
        url: String,
    ) = send(request) { store.attachLink(url, request.language, goalId) }

    private fun send(
        request: GoalUploadRequestRequest,
        attach: suspend () -> WriteOutcome<AttachedSource>,
    ) {
        if (work != null) return
        work = UploadWork.Attaching
        attachFailure = null
        saveFailed = false
        viewModelScope.launch {
            when (val attached = attach()) {
                is WriteOutcome.Done -> {
                    work = UploadWork.Sending
                    when (store.answerUploadRequest(goalId, listOf(attached.value.id))) {
                        is WriteOutcome.Done -> {
                            answered = request
                        }

                        WriteOutcome.Obsolete -> {}

                        else -> {
                            saveFailed = true
                        }
                    }
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    attachFailure = attached
                }
            }
            work = null
        }
    }
}
