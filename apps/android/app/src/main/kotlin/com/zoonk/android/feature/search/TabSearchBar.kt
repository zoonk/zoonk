package com.zoonk.android.feature.search

import android.view.KeyEvent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.clearText
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.material3.Badge
import androidx.compose.material3.ExpandedDockedSearchBar
import androidx.compose.material3.ExpandedFullScreenSearchBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SearchBar
import androidx.compose.material3.SearchBarDefaults
import androidx.compose.material3.SearchBarState
import androidx.compose.material3.SearchBarValue
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.rememberSearchBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.view.ViewCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.shell.GoalSwitcherViewModel
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.catalog.CatalogQuery
import com.zoonk.android.feature.catalog.catalogLanguage
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.launch

/**
 * Main's command palette (DECISIONS #4): a Material `SearchBar` under the tab roots' top app bar,
 * full screen on narrow windows and docked on wide ones, opened with Ctrl+K from a keyboard too.
 * Only the catalog is searched on the server; the rest comes from reads the app already has.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TabSearchBar(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val state = rememberSearchBarState()
    val text = rememberTextFieldState()
    val scope = rememberCoroutineScope()
    val wide = currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND)
    val switcher = viewModel { GoalSwitcherViewModel(app) }

    val close: () -> Unit = {
        text.clearText()
        scope.launch { state.animateToCollapsed() }
    }
    val act: (SearchAction) -> Unit = { action ->
        close()
        when (action) {
            is SearchAction.Open -> navigator.open(action.route)
            is SearchAction.ShowTab -> navigator.showRoot(action.tab)
            is SearchAction.SwitchGoal -> switcher.select(action.goalId)
            SearchAction.SignOut -> app.scope.launch { app.sessions.signOut() }
        }
    }

    val expanded = state.currentValue == SearchBarValue.Expanded
    val shownGroups = if (expanded) rememberSearchResults(app, text) else emptyList()

    val inputField =
        @Composable {
            SearchBarDefaults.InputField(
                textFieldState = text,
                searchBarState = state,
                onSearch = {
                    shownGroups
                        .firstOrNull()
                        ?.items
                        ?.firstOrNull()
                        ?.let { act(it.action) }
                },
                placeholder = { Text(stringResource(R.string.search_placeholder), maxLines = 1, overflow = TextOverflow.Ellipsis) },
                leadingIcon = {
                    if (expanded) {
                        IconButton(onClick = close) {
                            Icon(painterResource(R.drawable.ic_arrow_back), contentDescription = stringResource(R.string.search_close))
                        }
                    } else {
                        Icon(painterResource(R.drawable.ic_search), contentDescription = null)
                    }
                },
            )
        }

    // Docked results open at the bar's width, so a wide window's bar keeps Material's docked width.
    val width = if (wide) Modifier.widthIn(max = DOCKED_WIDTH) else Modifier.fillMaxWidth()
    SearchBar(state = state, inputField = inputField, modifier = width.padding(start = 16.dp, end = 16.dp, bottom = 8.dp))

    val results = @Composable { SearchResults(shownGroups, onOpen = { act(it.action) }) }

    if (wide) {
        ExpandedDockedSearchBar(state = state, inputField = inputField) { results() }
    } else {
        ExpandedFullScreenSearchBar(state = state, inputField = inputField) { results() }
    }

    OpenWithCtrlK(state)
}

/** The words, settled a moment after the last key so each keystroke doesn't read the catalog. */
@OptIn(FlowPreview::class)
@Composable
private fun rememberSearchResults(
    app: AppContainer,
    text: TextFieldState,
): List<SearchGroup> {
    var query by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(text) {
        snapshotFlow { text.text.toString().trim() }
            .debounce { if (it.isEmpty()) 0 else QUERY_SETTLE_MS }
            .collect { query = it }
    }

    val session by app.sessions.state.collectAsStateWithLifecycle()
    val summary by app.learnerSummary.summary.collectShown()
    val value = summary.value
    val language = catalogLanguage(currentLocale())
    val activeGoalId = value?.activeGoalId ?: value?.goals?.firstOrNull()?.id
    val searching = query.isNotEmpty()

    val catalog =
        if (searching) {
            app.catalog.search[CatalogQuery(language, query)]
                .collectShown()
                .value.value
        } else {
            null
        }
    val syllabus =
        if (searching && activeGoalId != null) {
            app.plans.syllabus[activeGoalId]
                .collectShown()
                .value.value
        } else {
            null
        }
    val mocks =
        if (searching && activeGoalId != null &&
            value?.places?.exam == true
        ) {
            app.search.mocks[activeGoalId]
                .collectShown()
                .value.value
                .orEmpty()
        } else {
            emptyList()
        }

    return searchGroups(
        query,
        SearchSources(
            summary = value,
            signedIn = session is SessionState.SignedIn,
            catalog = catalog,
            syllabus = syllabus,
            mocks = mocks,
        ),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchResults(
    groups: List<SearchGroup>,
    onOpen: (SearchItem) -> Unit,
) {
    val locale = currentLocale()
    val container = SearchBarDefaults.colors().containerColor

    LazyColumn(Modifier.fillMaxSize()) {
        groups.forEach { group ->
            item(key = "group-${group.id}", contentType = "header") {
                Text(
                    group.label,
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp).semantics { heading() },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.titleSmall,
                )
            }

            items(group.items, key = { "${group.id}/${it.id}" }, contentType = { "item" }) { item ->
                ListItem(
                    headlineContent = { Text(item.label, maxLines = 2, overflow = TextOverflow.Ellipsis) },
                    supportingContent = item.detail?.let { { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
                    leadingContent = item.icon?.let { { Icon(painterResource(it), contentDescription = null) } },
                    trailingContent = item.count?.let { { Badge { Text(formatNumber(it.toDouble(), locale)) } } },
                    colors = ListItemDefaults.colors(containerColor = container),
                    modifier = Modifier.clickable { onOpen(item) },
                )
            }
        }
    }
}

/** Main's ⌘K, for a hardware keyboard: a shortcut no focused field took opens search. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OpenWithCtrlK(state: SearchBarState) {
    val view = LocalView.current
    val scope = rememberCoroutineScope()

    DisposableEffect(view, state) {
        val listener =
            ViewCompat.OnUnhandledKeyEventListenerCompat { _, event ->
                val shortcut = event.keyCode == KeyEvent.KEYCODE_K && (event.isCtrlPressed || event.isMetaPressed)
                if (shortcut && event.action == KeyEvent.ACTION_DOWN) scope.launch { state.animateToExpanded() }
                shortcut
            }
        ViewCompat.addOnUnhandledKeyEventListener(view, listener)
        onDispose { ViewCompat.removeOnUnhandledKeyEventListener(view, listener) }
    }
}

private const val QUERY_SETTLE_MS = 250L
private val DOCKED_WIDTH = 560.dp
