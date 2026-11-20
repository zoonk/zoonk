package com.zoonk.android.feature.buddy

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Visit
import com.zoonk.android.data.VisitOutcome
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

    /** The glasses sheet while it shows: a pick that didn't save says so on it, and closing it ends it. */
    val glassesSheet = visit.opening()

    /** The name editor while it shows: its save closes it or says it didn't, and closing it ends it. */
    val editor = visit.opening()

    /** The editor's change saved, so it closes. */
    val editorSaved = editor.outcome<Unit>()

    private val glassesFailure = glassesSheet.outcome<Unit>()

    private val editorFailure = editor.outcome<Unit>()

    /** The glasses picked in the open sheet didn't save: the buddy is shown as it was. */
    val glassesSaveFailed get() = glassesFailure.value != null

    /** The open editor's change didn't save. */
    val editorSaveFailed get() = editorFailure.value != null

    fun saveGlasses(
        kind: BuddyKind,
        glasses: BuddyGlasses,
        name: String?,
    ) = save(glassesSheet, saved = null, glassesFailure, kind, glasses, name)

    fun saveEdit(
        kind: BuddyKind,
        glasses: BuddyGlasses,
        name: String?,
    ) = save(editor, editorSaved, editorFailure, kind, glasses, name)

    /** [asker]'s save: its success and its failure go to the opening that asked, while it's still open. */
    private fun save(
        asker: Visit,
        saved: VisitOutcome<Unit>?,
        failure: VisitOutcome<Unit>,
        kind: BuddyKind,
        glasses: BuddyGlasses,
        name: String?,
    ) {
        if (isSaving) return
        isSaving = true
        failure.clear()
        val started = asker.number
        viewModelScope.launch {
            val done =
                profile.setBuddy(
                    Buddy.Kind.entries.first { it.value == kind.key },
                    Buddy.Glasses.entries.first { it.value == glasses.key },
                    name?.trim()?.ifEmpty { null },
                )
            isSaving = false
            (if (done) saved else failure)?.send(started, Unit)
        }
    }

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
