package com.zoonk.android.feature.search

import android.view.KeyEvent
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SearchBarState
import androidx.compose.material3.rememberSearchBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalView
import androidx.core.view.ViewCompat
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** Search for the whole frame: the tab root's bar while one shows, search over the page elsewhere. */
@OptIn(ExperimentalMaterial3Api::class)
@Stable
class AppSearch internal constructor(
    private val scope: CoroutineScope,
    private val overPage: SearchBarState,
) {
    internal var tabBar: SearchBarState? by mutableStateOf(null)

    /** Main's ⌘K. */
    fun open() {
        scope.launch { (tabBar ?: overPage).animateToExpanded() }
    }
}

val LocalAppSearch = staticCompositionLocalOf<AppSearch?> { null }

/**
 * Lets a learner search from any page, as main's palette opens everywhere for anyone signed in:
 * Ctrl+K on a hardware keyboard, when no focused field took it, opens [AppSearch]. Pages without
 * the tab roots' bar get search full screen over them.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchHost(
    app: AppContainer,
    navigator: AppNavigator,
    signedIn: Boolean,
    content: @Composable () -> Unit,
) {
    val overPage = rememberSearchBarState()
    val scope = rememberCoroutineScope()
    val search = remember(scope, overPage) { AppSearch(scope, overPage) }

    CompositionLocalProvider(LocalAppSearch provides search) { content() }

    if (signedIn) {
        SearchPanel(app, navigator, overPage, docked = false)
        OpenWithCtrlK(search)
    }
}

@Composable
private fun OpenWithCtrlK(search: AppSearch) {
    val view = LocalView.current

    DisposableEffect(view, search) {
        val listener =
            ViewCompat.OnUnhandledKeyEventListenerCompat { _, event ->
                val shortcut = event.keyCode == KeyEvent.KEYCODE_K && (event.isCtrlPressed || event.isMetaPressed)
                if (shortcut && event.action == KeyEvent.ACTION_DOWN) search.open()
                shortcut
            }
        ViewCompat.addOnUnhandledKeyEventListener(view, listener)
        onDispose { ViewCompat.removeOnUnhandledKeyEventListener(view, listener) }
    }
}
