package com.zoonk.android.feature.buddy

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.page
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.api.models.Buddy
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

    /** The row whose block is opening, and the one whose block couldn't, so only that row says so. */
    var opening by mutableStateOf<BuddyTap?>(null)
        private set

    /** An answer that comes back after the learner left the page, or moved to another goal, belongs to no row and opens nothing. */
    private val visit = Visit()

    /** Where a mission's tap leads, once its block has started. */
    val route = visit.outcome<AppRoute>()

    private val openFailure = visit.outcome<BuddyTap>()

    /** The row whose mission failed to open on this visit. */
    val openFailed get() = openFailure.value

    /** A change saved on this visit, so an open editor closes. */
    val saved = visit.outcome<Unit>()

    private val saveFailure = visit.outcome<Unit>()

    /** A change didn't save on this visit: the buddy is shown as it was. */
    val saveFailed get() = saveFailure.value != null

    fun save(
        kind: BuddyKind,
        glasses: BuddyGlasses,
        name: String?,
    ) {
        if (isSaving) return
        isSaving = true
        saveFailure.clear()
        val started = visit.number
        viewModelScope.launch {
            val done =
                profile.setBuddy(
                    Buddy.Kind.entries.first { it.value == kind.key },
                    Buddy.Glasses.entries.first { it.value == glasses.key },
                    name?.trim()?.ifEmpty { null },
                )
            isSaving = false
            (if (done) saved else saveFailure).send(started, Unit)
        }
    }

    fun dismissSaveFailure() = saveFailure.clear()

    fun openMission(
        tap: BuddyTap,
        goalId: String,
    ) {
        tap.opens.page(goalId)?.let {
            route.send(visit.number, it)
            return
        }
        val blockId = (tap.opens as? MissionOpens.Block)?.blockId ?: return
        if (opening != null) return
        opening = tap
        openFailure.clear()
        val started = visit.number

        viewModelScope.launch {
            try {
                when (val result = opener.openMission(blockId)) {
                    is MutationResult.Done -> result.value?.let { route.send(started, it) } ?: store.status.refresh()
                    is MutationResult.Failed -> openFailure.send(started, tap)
                    MutationResult.Obsolete -> Unit
                }
            } finally {
                opening = null
            }
        }
    }

    /** The page left the screen (a lesson over it, another tab) or moved to another goal. */
    fun endVisit() = visit.end()
}

/** A tapped row of the buddy's day. A first step can open the same block as a mission, and only the tapped row shows how it went. */
data class BuddyTap(
    val opens: MissionOpens,
    val firstStep: Boolean = false,
)
