package com.zoonk.android.feature.search

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.clearText
import androidx.compose.foundation.text.input.rememberTextFieldState
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
import androidx.compose.material3.SearchBarScrollBehavior
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
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.app.shell.GoalSwitcherViewModel
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SignOutResult
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.catalog.CatalogQuery
import com.zoonk.android.feature.catalog.catalogLanguage
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.today.TodayRead
import com.zoonk.android.feature.today.TodayStore
import com.zoonk.android.feature.today.nextStep
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.launch

/**
 * Main's command palette (DECISIONS #4): a Material `SearchBar` under the tab roots' top app bar,
 * docked where the window has the room and full screen elsewhere. Ctrl+K opens it while it shows;
 * [SearchHost] opens search elsewhere.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TabSearchBar(
    app: AppContainer,
    navigator: AppNavigator,
    modifier: Modifier = Modifier,
) {
    val state = rememberSearchBarState()
    val docked = isSearchDocked()
    val host = LocalAppSearch.current

    DisposableEffect(host, state) {
        host?.tabBar = state
        onDispose { if (host?.tabBar === state) host.tabBar = null }
    }

    SearchPanel(app, navigator, state, docked) { inputField ->
        // Docked results open at the bar's width, so a wide window's bar keeps Material's docked width.
        val width = if (docked) Modifier.widthIn(max = DOCKED_WIDTH) else Modifier.fillMaxWidth()
        SearchBar(
            state = state,
            inputField = inputField,
            modifier = modifier.then(width).padding(start = 16.dp, end = 16.dp, bottom = 8.dp),
        )
    }
}

/** Phones' bar scrolls away with the page and back on the way up (Material's enter-always); a docked bar stays. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun rememberTabSearchScroll(): SearchBarScrollBehavior? {
    val behavior = SearchBarDefaults.enterAlwaysSearchBarScrollBehavior()
    return behavior.takeUnless { isSearchDocked() }
}

/** A landscape phone is wide but short: the keyboard would cover a docked panel. */
@Composable
private fun isSearchDocked(): Boolean {
    val sizeClass = currentWindowAdaptiveInfoV2().windowSizeClass
    return sizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND) &&
        sizeClass.isHeightAtLeastBreakpoint(WindowSizeClass.HEIGHT_DP_MEDIUM_LOWER_BOUND)
}

/**
 * Search itself: the field, what it finds and what a result does. [collapsed] draws the bar it
 * opens from, if any; without one it opens full screen. What the app already has filters as the
 * learner types; only the catalog is searched on the server.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SearchPanel(
    app: AppContainer,
    navigator: AppNavigator,
    state: SearchBarState,
    docked: Boolean,
    collapsed: @Composable (inputField: @Composable () -> Unit) -> Unit = {},
) {
    val text = rememberTextFieldState()
    val scope = rememberCoroutineScope()
    val snackbars = LocalSnackbarHostState.current
    val switcher = viewModel { GoalSwitcherViewModel(app) }
    val search = viewModel { SearchViewModel(app.today, app.studyOpener) }
    val continueFailed = stringResource(R.string.search_continue_failed)
    val signOutFailed = stringResource(R.string.account_sign_out_failed)
    val expanded = state.currentValue == SearchBarValue.Expanded

    // Back, a tap outside a docked panel and an opened result all end a search the same way.
    LaunchedEffect(expanded) { if (!expanded) text.clearText() }

    val close: () -> Unit = { scope.launch { state.animateToCollapsed() } }
    val act: (SearchAction) -> Unit = { action ->
        close()
        when (action) {
            is SearchAction.Open -> {
                navigator.open(action.route)
            }

            is SearchAction.ShowTab -> {
                navigator.showRoot(action.tab)
            }

            is SearchAction.SwitchGoal -> {
                switcher.select(action.goalId)
            }

            SearchAction.SignOut -> {
                // The app's scope: closing search mustn't cancel it halfway.
                app.scope.launch { if (app.sessions.signOut() is SignOutResult.Failed) snackbars.showSnackbar(signOutFailed) }
            }

            SearchAction.Continue -> {
                search.continueToday(
                    open = { route -> if (route == null) navigator.showRoot(AppTab.Today) else navigator.open(route) },
                    failed = { scope.launch { snackbars.showSnackbar(continueFailed) } },
                )
            }
        }
    }

    val groups = if (expanded) rememberSearchGroups(app, text) else emptyList()
    val first =
        groups
            .firstOrNull()
            ?.items
            ?.firstOrNull()
            ?.takeIf { text.text.isNotBlank() }
    val enterOpens by rememberUpdatedState(first)

    val inputField =
        @Composable {
            SearchBarDefaults.InputField(
                textFieldState = text,
                searchBarState = state,
                onSearch = { enterOpens?.let { act(it.action) } },
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
                trailingIcon = {
                    if (expanded && text.text.isNotEmpty()) {
                        IconButton(onClick = { text.clearText() }) {
                            Icon(painterResource(R.drawable.ic_close), contentDescription = stringResource(R.string.search_clear))
                        }
                    }
                },
            )
        }

    collapsed(inputField)

    val results = @Composable { SearchResults(groups, highlighted = first, onOpen = { act(it.action) }) }

    if (docked) {
        ExpandedDockedSearchBar(state = state, inputField = inputField) { results() }
    } else {
        ExpandedFullScreenSearchBar(state = state, inputField = inputField) { results() }
    }
}

class SearchViewModel(
    private val today: TodayStore,
    private val opener: StudyOpener,
) : ViewModel() {
    private var opening = false

    /**
     * Opens today's next step as Today's Start does. With no day read to start from, [open] gets
     * null and Today shows where the day stands; the same when the day changed meanwhile.
     */
    internal fun continueToday(
        open: (AppRoute?) -> Unit,
        failed: () -> Unit,
    ) {
        if (opening) return
        val read = today.today.state.value.value as? TodayRead.Day
        val step = read?.day?.nextStep

        if (read == null || step == null) {
            open(null)
            return
        }

        opening = true
        viewModelScope.launch {
            try {
                when (val result = opener.open(read.day, step, next = true, read.today.goal.id)) {
                    is MutationResult.Done -> open(result.value)
                    is MutationResult.Failed -> failed()
                    MutationResult.Obsolete -> Unit
                }
            } finally {
                opening = false
            }
        }
    }
}

/**
 * The groups follow the words as typed; the server's results (the catalog, and the plan and mocks
 * reads they need) wait for two characters and a moment after the last key, as main's do.
 */
@OptIn(FlowPreview::class)
@Composable
private fun rememberSearchGroups(
    app: AppContainer,
    text: TextFieldState,
): List<SearchGroup> {
    var settled by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(text) {
        snapshotFlow { text.text.toString().trim() }
            .debounce { if (it.length < MIN_SERVER_QUERY) 0 else QUERY_SETTLE_MS }
            .collect { settled = it.takeIf { query -> query.length >= MIN_SERVER_QUERY }.orEmpty() }
    }

    val session by app.sessions.state.collectAsStateWithLifecycle()
    val summary by app.learnerSummary.summary.collectShown()
    val value = summary.value
    val language = catalogLanguage(currentLocale())
    val activeGoalId = value?.activeGoalId ?: value?.goals?.firstOrNull()?.id
    val reading = settled.isNotEmpty()

    val catalog =
        if (reading) {
            app.catalog.search[CatalogQuery(language, settled)]
                .collectShown()
                .value.value
        } else {
            null
        }
    val syllabus =
        if (reading && activeGoalId != null) {
            app.plans.syllabus[activeGoalId]
                .collectShown()
                .value.value
        } else {
            null
        }
    val mocks =
        if (reading && activeGoalId != null && value?.places?.exam == true) {
            app.search.mocks[activeGoalId]
                .collectShown()
                .value.value
                .orEmpty()
        } else {
            emptyList()
        }

    return searchGroups(
        text.text.toString().trim(),
        SearchSources(
            summary = value,
            signedIn = session is SessionState.SignedIn,
            catalog = catalog,
            syllabus = syllabus,
            mocks = mocks,
        ),
    )
}

/** [highlighted] is what Enter opens, shown on its tint as main's palette highlights it. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchResults(
    groups: List<SearchGroup>,
    highlighted: SearchItem?,
    onOpen: (SearchItem) -> Unit,
) {
    val locale = currentLocale()
    val container = SearchBarDefaults.colors().containerColor
    val tint = MaterialTheme.colorScheme.surfaceContainerHighest

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

            itemsIndexed(group.items, key = { _, item -> "${group.id}/${item.id}" }, contentType = { _, _ -> "item" }) { _, item ->
                ListItem(
                    headlineContent = { Text(item.label, maxLines = 2, overflow = TextOverflow.Ellipsis) },
                    supportingContent =
                        item.detail?.let { detail ->
                            { Text(detail.replaceFirstChar { it.titlecase(locale) }, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                        },
                    leadingContent = { Icon(painterResource(item.icon), contentDescription = null) },
                    trailingContent =
                        item.count?.let { count ->
                            {
                                Text(
                                    formatNumber(count.toDouble(), locale),
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.labelLarge.withTabularFigures(),
                                )
                            }
                        },
                    colors = ListItemDefaults.colors(containerColor = if (item == highlighted) tint else container),
                    modifier = Modifier.clickable { onOpen(item) },
                )
            }
        }
    }
}

private const val QUERY_SETTLE_MS = 250L
private const val MIN_SERVER_QUERY = 2
private val DOCKED_WIDTH = 560.dp
