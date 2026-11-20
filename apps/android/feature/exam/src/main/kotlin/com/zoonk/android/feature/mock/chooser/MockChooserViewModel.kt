package com.zoonk.android.feature.mock.chooser

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.api.models.MockShape
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Main's `MockChooserClient`: Start asks for the mock, which opens, or is saved as the learner's
 * request while its questions are written (the options then say so).
 */
class MockChooserViewModel(
    private val goalId: UUID,
    private val starter: MockStarter,
    private val refused: suspend () -> Unit = {},
) : ViewModel() {
    private val mutableBusy = MutableStateFlow(false)
    private val mutableFailed = MutableStateFlow(false)
    private val mutableOpened = MutableStateFlow<String?>(null)
    private val mutableTriedLocked = MutableStateFlow(false)

    /** Asking for the mock. */
    val busy: StateFlow<Boolean> = mutableBusy.asStateFlow()

    /** The last Start failed. */
    val failed: StateFlow<Boolean> = mutableFailed.asStateFlow()

    /** The mock to open: started, or the one that was running. */
    val opened: StateFlow<String?> = mutableOpened.asStateFlow()

    /** The learner pressed Start on a locked mock, or the server refused a start: the gate shows while the mocks read locked. */
    val triedLocked: StateFlow<Boolean> = mutableTriedLocked.asStateFlow()

    fun tryLocked() {
        mutableTriedLocked.value = true
    }

    fun start(shape: MockShape) {
        if (mutableBusy.value) return
        mutableBusy.value = true
        mutableFailed.value = false
        viewModelScope.launch {
            when (val result = starter.start(goalId, shape)) {
                is MutationResult.Done -> {
                    when (val outcome = result.value) {
                        is MockStartOutcome.Opened -> mutableOpened.value = outcome.id
                        MockStartOutcome.Preparing -> {}
                        MockStartOutcome.PlusRequired -> metTheLock()
                    }
                }

                is MutationResult.Failed -> {
                    mutableFailed.value = true
                }

                MutationResult.Obsolete -> {}
            }
            mutableBusy.value = false
        }
    }

    /** The server's refusal is the options' access now ([refused] writes it), so the gate reads it from them. */
    private fun metTheLock() {
        tryLocked()
        viewModelScope.launch { refused() }
    }
}
