package com.zoonk.android.feature.memory

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException
import java.io.OutputStream
import java.util.UUID

class MemoryViewModel(
    private val store: MemoryStore,
) : ViewModel() {
    /** The last deletion, offered for Undo. */
    var lastChange by mutableStateOf<MemoryChangeShown?>(null)
        private set

    var lastUndo by mutableStateOf(MemoryUndo.Offered)
        private set

    /** A change didn't save: it was put back. */
    var saveFailed by mutableStateOf(false)
        private set

    var isExporting by mutableStateOf(false)
        private set
    var exportFailed by mutableStateOf(false)
        private set

    fun setEnabled(enabled: Boolean) = save { store.setEnabled(enabled) }

    fun updateFact(
        id: UUID,
        statement: String,
    ) = save { store.updateFact(id, statement) }

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
        if (lastUndo != MemoryUndo.Offered) return
        lastUndo = MemoryUndo.Undoing
        viewModelScope.launch {
            val undone = store.undo(listOf(change.reference))
            if (lastChange == change) lastUndo = if (undone) MemoryUndo.Undone else MemoryUndo.Failed
        }
    }

    fun export(open: () -> OutputStream?) {
        if (isExporting) return
        isExporting = true
        exportFailed = false
        viewModelScope.launch {
            try {
                val json = store.export()
                exportFailed = json == null || !withContext(Dispatchers.IO) { write(open, json) }
            } finally {
                isExporting = false
            }
        }
    }

    private fun save(write: suspend () -> Boolean) {
        saveFailed = false
        viewModelScope.launch { saveFailed = !write() }
    }

    private fun write(
        open: () -> OutputStream?,
        json: String,
    ): Boolean =
        try {
            open()?.use { it.write(json.toByteArray()) } != null
        } catch (e: IOException) {
            false
        } catch (e: SecurityException) {
            false
        }
}
