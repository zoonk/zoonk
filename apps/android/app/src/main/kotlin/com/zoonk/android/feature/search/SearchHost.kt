package com.zoonk.android.feature.search

import android.view.KeyEvent
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.SearchBar
import androidx.compose.material3.SearchBarDefaults
import androidx.compose.material3.SearchBarState
import androidx.compose.material3.Text
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.core.view.ViewCompat
import com.zoonk.android.R
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

/** Null while nobody is signed in, as main's palette is a learner's. */
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

    CompositionLocalProvider(LocalAppSearch provides search.takeIf { signedIn }) { content() }

    if (signedIn) {
        SearchPanel(app, navigator, overPage, docked = false) { HeightOnlyBar(overPage) }
        OpenWithCtrlK(search)
    }
}

/**
 * Material sizes the full-screen search's field to its collapsed bar's height, a fixed 56dp without
 * one, which cuts larger text. A page has no bar, so this one, unseen above the window and disabled,
 * gives the field the height its text needs.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HeightOnlyBar(state: SearchBarState) {
    SearchBar(
        state = state,
        inputField = {
            SearchBarDefaults.InputField(
                textFieldState = rememberTextFieldState(),
                searchBarState = state,
                onSearch = {},
                enabled = false,
                placeholder = { Text(stringResource(R.string.search_placeholder), maxLines = 1) },
                leadingIcon = { Icon(painterResource(R.drawable.ic_search), contentDescription = null) },
            )
        },
        modifier =
            Modifier
                .fillMaxWidth()
                .clearAndSetSemantics {}
                .layout { measurable, constraints ->
                    val bar = measurable.measure(constraints)
                    layout(0, 0) { bar.place(0, -bar.height) }
                },
    )
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

/** Main's "Search or ask…" in the catalog bar's account menu, as a top app bar action where there's no search bar. */
@Composable
fun SearchAction() {
    val search = LocalAppSearch.current ?: return

    IconButton(onClick = search::open) {
        Icon(painterResource(R.drawable.ic_search), contentDescription = stringResource(R.string.search_open))
    }
}
