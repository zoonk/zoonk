package com.zoonk.android.feature.activities.code

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

/**
 * One run at a time of code the learner keeps editing, as main's `useEditorRun`. Run it in the screen's
 * `rememberCoroutineScope()`, so leaving the screen drops the result.
 */
@Stable
class EditorRun {
    private var revision = 0

    var isRunning by mutableStateOf(false)
        private set

    /** The learner edited the code since the shown result. */
    var isStale by mutableStateOf(false)
        private set

    fun edit() {
        revision += 1
        isStale = true
    }

    /** The revision to pass to [finish], or null while another run is going. */
    fun start(): Int? {
        if (isRunning) return null
        isRunning = true
        return revision
    }

    /** False when the code changed while it ran, so the result describes older code. */
    fun finish(startedRevision: Int): Boolean {
        isRunning = false
        isStale = revision != startedRevision
        return !isStale
    }
}

@Composable
fun rememberEditorRun(): EditorRun = remember { EditorRun() }
