package com.zoonk.android.app

import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteType
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * The window's snackbars (main's toasts), shown by the shell or, over a task, by its scaffold.
 * Outside the shell (previews, tests) nothing shows them.
 */
val LocalSnackbarHostState = staticCompositionLocalOf { SnackbarHostState() }

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
