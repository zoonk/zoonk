package com.zoonk.android.app

import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteType
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * The window's snackbars (main's toasts), shown by the shell or, over a task, by its scaffold, and
 * by a full-screen dialog open over them ([SnackbarLayer]). Outside the shell (previews, tests)
 * nothing shows them.
 */
val LocalSnackbarHostState = staticCompositionLocalOf { SnackbarHostState() }

/**
 * A layer of the window's snackbar hosts: the screen's, or a sheet's or full-screen dialog's, whose
 * own window opens over it. Only the topmost layer shows the window's snackbars, so one raised
 * while a sheet or dialog is open shows on it, or waits until it closes, instead of expiring
 * unseen behind it.
 */
class SnackbarLayer {
    private var covers by mutableIntStateOf(0)

    val isCovered: Boolean get() = covers > 0

    fun cover() {
        covers++
    }

    fun uncover() {
        covers--
    }
}

val LocalSnackbarLayer = staticCompositionLocalOf { SnackbarLayer() }

/** How the shell shows its navigation, so a page's own controls leave out what its drawer already has. */
val LocalNavigationSuiteType = staticCompositionLocalOf { NavigationSuiteType.None }

/** The tops of the docked action bars on screen, so the shell's snackbars rise above them as a Scaffold's do above its bottom bar. */
class SnackbarAnchors {
    private val tops = mutableStateMapOf<Any, Float>()

    val highest: Float? get() = tops.values.minOrNull()

    fun set(
        key: Any,
        top: Float,
    ) {
        tops[key] = top
    }

    fun remove(key: Any) {
        tops.remove(key)
    }
}

val LocalSnackbarAnchors = staticCompositionLocalOf { SnackbarAnchors() }
