package com.zoonk.android.feature.buddy

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.page
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.api.models.Buddy
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch

class BuddyViewModel internal constructor(
    private val store: BuddyStore,
    private val profile: LearningProfileStore,
    private val opener: StudyOpener,
) : ViewModel() {
    var isSaving by mutableStateOf(false)
        private set

    /** Search's question goes in the composer once: the tab keeps its route, so the page would put it back on each return. */
    var askPlaced = false

    /** A change didn't save: the buddy is shown as it was. */
    var saveFailed by mutableStateOf(false)
        private set

    /** The row whose block is opening, and the one whose block couldn't, so only that row says so. */
    var opening by mutableStateOf<BuddyTap?>(null)
        private set

    var openFailed by mutableStateOf<BuddyTap?>(null)
        private set

    /** An answer that comes back after the learner left the page, or moved to another goal, belongs to no row and opens nothing. */
    private var visit = 0

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

    fun openMission(
        tap: BuddyTap,
        goalId: String,
    ) {
        tap.opens.page(goalId)?.let {
            opened.trySend(it)
            return
        }
        val blockId = (tap.opens as? MissionOpens.Block)?.blockId ?: return
        if (opening != null) return
        opening = tap
        openFailed = null
        val started = visit

        viewModelScope.launch {
            try {
                when (val result = opener.openMission(blockId)) {
                    is MutationResult.Done -> result.value?.let { if (visit == started) opened.trySend(it) } ?: store.status.refresh()
                    is MutationResult.Failed -> if (visit == started) openFailed = tap
                    MutationResult.Obsolete -> Unit
                }
            } finally {
                opening = null
            }
        }
    }

    /** The page left the screen (a lesson over it, another tab) or moved to another goal. */
    fun endVisit() {
        visit++
        openFailed = null
    }
}

/** A tapped row of the buddy's day. A first step can open the same block as a mission, and only the tapped row shows how it went. */
data class BuddyTap(
    val opens: MissionOpens,
    val firstStep: Boolean = false,
)
