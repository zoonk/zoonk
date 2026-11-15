package com.zoonk.android.feature.memory

import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.SavedStateHandleSaveableApi
import androidx.lifecycle.viewmodel.compose.saveable
import com.zoonk.android.data.Visit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException
import java.io.OutputStream
import java.util.UUID

/** [open] gives the stream of a file the learner picked, from the application's content resolver, or null when it can't be opened. */
@OptIn(SavedStateHandleSaveableApi::class)
class MemoryViewModel(
    private val store: MemoryStore,
    private val open: (Uri) -> OutputStream?,
    handle: SavedStateHandle,
) : ViewModel() {
    /** This visit to the page: a download that fails says so only on it. */
    val visit = Visit()

    private val exportFailure = visit.outcome<Unit>()

    /** The last deletion, offered for Undo. */
    var lastChange by mutableStateOf<MemoryChangeShown?>(null)
        private set

    var lastUndo by mutableStateOf(MemoryUndo.Offered)
        private set

    private val saveFailure = visit.outcome<Unit>()

    /** A change didn't save on this visit: it was put back. */
    val saveFailed get() = saveFailure.value != null

    var isExporting by mutableStateOf(false)
        private set

    /** The download didn't save, on this visit. */
    val exportFailed get() = exportFailure.value != null

    fun setEnabled(enabled: Boolean) = save { store.setEnabled(enabled) }

    private var editedFact by handle.saveable { mutableStateOf<UUID?>(null) }

    private var editSaving by mutableStateOf(false)

    private var editFailed by mutableStateOf(false)

    /** The fact whose edit is open, kept through a reclaimed process; it waits while its save is out and keeps the text when the save fails. */
    val factEdit get() = editedFact?.let { FactEdit(it, editSaving, editFailed) }

    fun openEdit(id: UUID) {
        if (!editSaving) edit(id)
    }

    fun closeEdit() {
        if (!editSaving) edit(null)
    }

    fun saveEdit(statement: String) {
        val id = editedFact?.takeUnless { editSaving } ?: return
        editSaving = true
        editFailed = false
        viewModelScope.launch {
            val saved = store.updateFact(id, statement)
            editSaving = false
            if (saved) edit(null) else editFailed = true
        }
    }

    private fun edit(id: UUID?) {
        editedFact = id
        editFailed = false
    }

    fun deleteFact(id: UUID) =
        save {
            val change = store.deleteFact(id) ?: return@save false
            lastChange =
                MemoryChangeShown(
                    factId = null,
                    statement = null,
                    previousFactId = change.previous.id,
                    previousStatement = change.previous.statement,
                )
            lastUndo = MemoryUndo.Offered
            true
        }

    fun undo() {
        val change = lastChange ?: return
        if (!lastUndo.canUndo) return
        lastUndo = MemoryUndo.Undoing
        viewModelScope.launch {
            val undo = store.undo(listOf(change.reference)).memoryUndo()
            if (lastChange == change) lastUndo = undo
        }
    }

    /** Writes the download to the file the learner picked at [to]; it's written even after the page goes. */
    fun export(to: Uri) {
        if (isExporting) return
        isExporting = true
        exportFailure.clear()
        val started = visit.number
        viewModelScope.launch {
            try {
                val json = store.export()
                if (json == null || !withContext(Dispatchers.IO) { write(to, json) }) exportFailure.send(started, Unit)
            } finally {
                isExporting = false
            }
        }
    }

    private fun save(write: suspend () -> Boolean) {
        saveFailure.clear()
        val started = visit.number
        viewModelScope.launch { if (!write()) saveFailure.send(started, Unit) }
    }

    private fun write(
        to: Uri,
        json: String,
    ): Boolean =
        try {
            open(to)?.use { it.write(json.toByteArray()) } != null
        } catch (e: IOException) {
            false
        } catch (e: SecurityException) {
            false
        }
}

data class FactEdit(
    val id: UUID,
    val saving: Boolean = false,
    val failed: Boolean = false,
)
