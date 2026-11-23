package com.zoonk.android.feature.mock.chooser

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.mock.MockPaperWait
import com.zoonk.api.models.MockShape
import kotlinx.coroutines.CoroutineScope
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
    val goalId: UUID,
    private val starter: MockStarter,
    val paperWait: (CoroutineScope) -> MockPaperWait,
    private val refused: suspend () -> Unit = {},
) : ViewModel() {
    private val mutableBusy = MutableStateFlow(false)
    private val mutableFailed = MutableStateFlow(false)
    private val mutableRefusal = MutableStateFlow<MockStartOutcome?>(null)
    private val mutableOpened = MutableStateFlow<String?>(null)
    private val mutableTriedLocked = MutableStateFlow(false)

    val busy: StateFlow<Boolean> = mutableBusy.asStateFlow()

    val failed: StateFlow<Boolean> = mutableFailed.asStateFlow()

    val refusal: StateFlow<MockStartOutcome?> = mutableRefusal.asStateFlow()

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
                        is MockStartOutcome.Opened -> {
                            mutableOpened.value = outcome.id
                        }

                        MockStartOutcome.Preparing -> {}

                        MockStartOutcome.PlusRequired -> {
                            metTheLock()
                        }

                        is MockStartOutcome.GradesUsed, is MockStartOutcome.NeedsChoice, MockStartOutcome.SignUpRequired -> {
                            mutableRefusal.value = outcome
                        }
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

    private fun metTheLock() {
        tryLocked()
        viewModelScope.launch { refused() }
    }
}
