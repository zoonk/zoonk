package com.zoonk.android.feature.savedlessons

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppSnackbars
import com.zoonk.android.data.KeptRows
import com.zoonk.android.data.SaveFailure
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.saves.BookmarkToggle
import com.zoonk.android.feature.saves.SaveMenu
import com.zoonk.android.feature.saves.SaveSwipe
import com.zoonk.android.feature.saves.SaveWords
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.ButtonEdge
import com.zoonk.android.ui.components.iconButtonEdge
import com.zoonk.api.models.SavedLesson
import kotlinx.coroutines.flow.StateFlow
import java.util.UUID

/** A lesson's own words for saving it, apart from a map's. */
@Composable
fun lessonSaveWords() = SaveWords(stringResource(R.string.savedlessons_save), stringResource(R.string.savedlessons_unsave))

/** The lesson player's bookmark, just before its "…": "Save" until it's "Saved". */
@Composable
fun LessonBookmark(
    saved: Boolean,
    onToggle: () -> Unit,
) {
    BookmarkToggle(saved, stringResource(if (saved) R.string.savedlessons_saved else R.string.savedlessons_save), onToggle)
}

/** A lesson row's bookmark, its glyph on the row's end edge, named with the lesson's [title] so TalkBack tells the rows apart. */
@Composable
fun LessonRowBookmark(
    title: String,
    saved: Boolean,
    onToggle: () -> Unit,
) {
    BookmarkToggle(
        saved,
        stringResource(if (saved) R.string.savedlessons_saved_named else R.string.savedlessons_save_named, title),
        onToggle,
        Modifier.iconButtonEdge(ButtonEdge.End),
    )
}

/**
 * A lesson row that saves: a swipe either way and its long-press menu do what its bookmark does. [row] draws it with
 * the long press it hands over (its label and what opens the menu).
 */
@Composable
fun LessonSaveRow(
    saved: Boolean,
    onToggle: () -> Unit,
    row: @Composable (longPressLabel: String, onLongPress: () -> Unit) -> Unit,
) {
    val words = lessonSaveWords()
    var menu by remember { mutableStateOf(false) }

    SaveSwipe(saved, words, onToggle) {
        Box {
            row(if (saved) words.unsave else words.save) { menu = true }
            SaveMenu(menu, saved, words, onDismiss = { menu = false }, onToggle = onToggle)
        }
    }
}

/**
 * A screen's saves of lessons for [goalId] on one visit: the bookmarks it shows, and the Saved lessons list's rows
 * the learner changed, kept where they were until the visit ends.
 */
class LessonSavesViewModel(
    store: SavedLessonsStore,
    goalId: UUID,
) : ViewModel() {
    private val kept = KeptRows<SavedLesson, UUID> { it.lessonId }
    val visit = Visit(onEnd = kept::clear)
    private val saves = store.saves(viewModelScope, visit, goalId)
    val failed get() = saves.failed

    /** Each lesson the learner changed on this visit, as it shows now. */
    val states: StateFlow<Map<UUID, Boolean>> = saves.states

    fun set(
        lessonId: UUID,
        saved: Boolean,
    ) = saves.set(lessonId, saved)

    /** The saved lessons [served] lists now, with each one changed on this visit where it showed. */
    fun shown(
        served: List<SavedLesson>,
        states: Map<UUID, Boolean>,
    ): List<SavedLesson> = kept.arrange(served) { it in states }
}

/** The screen's lesson saves, for as long as it's composed: their failures show in the app's snackbars. */
@Composable
fun rememberLessonSaves(
    store: SavedLessonsStore,
    goalId: UUID,
    snackbars: AppSnackbars,
): LessonSavesViewModel {
    val saves = viewModel(key = "lesson-saves-$goalId") { LessonSavesViewModel(store, goalId) }
    VisitOf(saves.visit)
    ActOn(saves.failed) {
        snackbars.show(if (it == SaveFailure.Save) R.string.savedlessons_save_failed else R.string.savedlessons_remove_failed)
    }
    return saves
}
