package com.zoonk.android.feature.buddy

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.value
import com.zoonk.android.feature.session.DayView
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.page
import com.zoonk.android.feature.today.TodayRead
import com.zoonk.android.feature.today.TodayStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.api.models.Buddy
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import java.util.UUID

class BuddyViewModel internal constructor(
    private val store: BuddyStore,
    private val profile: LearningProfileStore,
    private val today: TodayStore,
    private val opener: StudyOpener,
) : ViewModel() {
    var isSaving by mutableStateOf(false)
        private set

    /** Search's question goes in the composer once: the tab keeps its route, so the page would put it back on each return. */
    var askPlaced = false

    /** A change didn't save: the buddy is shown as it was. */
    var saveFailed by mutableStateOf(false)
        private set

    var isOpening by mutableStateOf(false)
        private set

    var openFailed by mutableStateOf(false)
        private set

    private val opened = Channel<AppRoute>(Channel.BUFFERED)

    /** Where a mission's tap leads, once its block has started. */
    val routes: Flow<AppRoute> = opened.receiveAsFlow()

    /** [onSaved] runs only once it saved, so an editor closes then. */
    fun save(
        kind: BuddyKind,
        glasses: BuddyGlasses,
        name: String?,
        onSaved: () -> Unit = {},
    ) {
        if (isSaving) return
        isSaving = true
        saveFailed = false
        viewModelScope.launch {
            val saved =
                profile.setBuddy(
                    Buddy.Kind.entries.first { it.value == kind.key },
                    Buddy.Glasses.entries.first { it.value == glasses.key },
                    name?.trim()?.ifEmpty { null },
                )
            isSaving = false
            saveFailed = !saved
            if (saved) onSaved()
        }
    }

    fun dismissSaveFailure() {
        saveFailed = false
    }

    /**
     * A mission's page opens at once; its block opens in the session Today holds it in, read when
     * the learner taps so the page itself reads nothing extra.
     */
    fun openMission(
        opens: MissionOpens,
        goalId: String,
    ) {
        opens.page(goalId)?.let {
            opened.trySend(it)
            return
        }
        val blockId = (opens as? MissionOpens.Block)?.blockId ?: return
        if (isOpening) return
        isOpening = true
        openFailed = false

        viewModelScope.launch {
            try {
                val sessionId =
                    today.sessionHolding(blockId, goalId) ?: run {
                        store.status.refresh()
                        return@launch
                    }
                when (val result = opener.openMission(blockId, sessionId)) {
                    is MutationResult.Done -> result.value?.let(opened::trySend) ?: store.status.refresh()
                    is MutationResult.Failed -> openFailed = true
                    MutationResult.Obsolete -> Unit
                }
            } finally {
                isOpening = false
            }
        }
    }
}

private suspend fun TodayStore.sessionHolding(
    blockId: UUID,
    goalId: String,
): UUID? {
    today.load()
    // Today read before the day was opened elsewhere doesn't have the block yet.
    if (dayHolding(blockId, goalId) == null) today.refresh()
    return dayHolding(blockId, goalId)?.sessionId
}

private fun TodayStore.dayHolding(
    blockId: UUID,
    goalId: String,
): DayView? {
    val read = today.state.value.value as? TodayRead.Day ?: return null
    val goal = read.today.goal.id
    return read.day.takeIf { goal.toString() == goalId && it.steps.any { step -> step.id == blockId } }
}
