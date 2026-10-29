package com.zoonk.android.feature.stats

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.scaffold.PageScaffold
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

/** Main's stats section: its pages, in its nav's order. */
enum class StatsPage(
    val route: AppRoute,
    @param:StringRes val label: Int,
) {
    Overview(AppRoute.Statistics, R.string.stats_overview),
    Level(AppRoute.StatsLevel, R.string.stats_level),
    Energy(AppRoute.StatsEnergy, R.string.stats_energy),
    Activity(AppRoute.StatsActivity, R.string.stats_activity),
    Score(AppRoute.StatsScore, R.string.stats_score),
    Patterns(AppRoute.StatsPatterns, R.string.stats_patterns),
}

/** What a stats page needs from the frame: the window's room and a way to its sibling pages. */
internal class StatsContext(
    val app: AppContainer,
    val navigator: AppNavigator,
    val stats: StatsStore,
    val wide: Boolean,
) {
    fun open(page: StatsPage) = navigator.open(page.route)
}

/**
 * Main's stats layout: "All goals" and the page's title over its content, with the section's nav
 * as tabs on narrow windows and a list beside the page on wide ones. [shown] are the reads the
 * page shows, which pull to refresh reads again.
 */
@Composable
fun StatsScreen(
    page: StatsPage,
    app: AppContainer,
    navigator: AppNavigator,
    stats: StatsStore = app.stats,
) {
    val sizeClass = currentWindowAdaptiveInfoV2().windowSizeClass
    val besideList = sizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND)
    val context =
        StatsContext(app, navigator, stats, wide = sizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND))
    val shown = shownBy(page, stats, context.wide)
    val state by shown.first().collectShown()
    val isRefreshing by remember(shown) { combine(shown.map { it.isRefreshing }) { reads -> reads.any { it } } }
        .collectAsStateWithLifecycle(false)
    val scope = rememberCoroutineScope()
    val refresh: () -> Unit = { shown.forEach { scope.launch { it.refresh() } } }

    PageScaffold(onBack = { navigator.back() }, title = { Text(stringResource(R.string.navigation_statistics)) }) { padding ->
        Row(Modifier.fillMaxSize().padding(padding)) {
            if (besideList) StatsNavList(page, navigator, Modifier.width(240.dp))

            Column(Modifier.weight(1f)) {
                if (!besideList) StatsTabs(page, navigator)

                PullToRefreshBox(isRefreshing = isRefreshing, onRefresh = refresh, modifier = Modifier.fillMaxSize()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                        LazyColumn(
                            modifier = Modifier.widthIn(max = PAGE_WIDTH).fillMaxSize(),
                            contentPadding = PaddingValues(horizontal = if (context.wide) 24.dp else 16.dp, vertical = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(32.dp),
                        ) {
                            item(key = "header") { StatsHeader(page) }
                            item(key = "content") {
                                when (state) {
                                    LoadState.Idle, LoadState.Loading -> {
                                        Box(
                                            Modifier.fillMaxWidth().padding(48.dp),
                                            contentAlignment = Alignment.Center,
                                        ) { CircularProgressIndicator() }
                                    }

                                    is LoadState.Failed -> {
                                        LoadFailedMessage(onRetry = refresh)
                                    }

                                    else -> {
                                        StatsPageContent(page, context)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** The overview's score trend shows only on wide windows. */
private fun shownBy(
    page: StatsPage,
    stats: StatsStore,
    wide: Boolean,
): List<Resource<*>> =
    when (page) {
        StatsPage.Overview -> listOfNotNull(stats.progress, stats.energy, stats.activity, stats.score.takeIf { wide }, stats.patterns)
        StatsPage.Level -> listOf(stats.progress)
        StatsPage.Energy -> listOf(stats.energy)
        StatsPage.Activity -> listOf(stats.activity)
        StatsPage.Score -> listOf(stats.score)
        StatsPage.Patterns -> listOf(stats.patterns)
    }

@Composable
private fun StatsPageContent(
    page: StatsPage,
    context: StatsContext,
) {
    when (page) {
        StatsPage.Overview -> StatsOverview(context)
        StatsPage.Level -> LevelPage(context)
        StatsPage.Energy -> EnergyPage(context)
        StatsPage.Activity -> ActivityPage(context)
        StatsPage.Score -> ScorePage(context)
        StatsPage.Patterns -> PatternsPage(context)
    }
}

@Composable
private fun StatsHeader(page: StatsPage) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            stringResource(R.string.stats_all_goals),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
        Text(
            stringResource(if (page == StatsPage.Overview) R.string.navigation_statistics else page.label),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.headlineSmall,
        )
    }
}

@Composable
private fun StatsTabs(
    page: StatsPage,
    navigator: AppNavigator,
) {
    val label = stringResource(R.string.stats_nav)

    PrimaryScrollableTabRow(
        selectedTabIndex = page.ordinal,
        modifier = Modifier.semantics { contentDescription = label },
        edgePadding = 16.dp,
    ) {
        StatsPage.entries.forEach { entry ->
            Tab(selected = entry == page, onClick = { navigator.open(entry.route) }, text = { Text(stringResource(entry.label)) })
        }
    }
}

@Composable
private fun StatsNavList(
    page: StatsPage,
    navigator: AppNavigator,
    modifier: Modifier = Modifier,
) {
    val label = stringResource(R.string.stats_nav)
    val selected = MaterialTheme.colorScheme.surfaceContainerHigh

    Column(
        modifier
            .verticalScroll(rememberScrollState())
            .padding(vertical = 12.dp)
            .selectableGroup()
            .semantics { contentDescription = label },
    ) {
        StatsPage.entries.forEach { entry ->
            ListItem(
                headlineContent = { Text(stringResource(entry.label)) },
                colors = ListItemDefaults.colors(containerColor = if (entry == page) selected else MaterialTheme.colorScheme.surface),
                modifier = Modifier.selectable(selected = entry == page, role = Role.Tab) { navigator.open(entry.route) },
            )
        }
    }
}

/** A learner who hasn't studied yet: main's empty state, which leads to Today. */
@Composable
internal fun StatsEmpty(context: StatsContext) {
    Column(Modifier.padding(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Icon(painterResource(R.drawable.ic_bar_chart), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            stringResource(R.string.stats_empty_title),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleMedium,
        )
        Button(onClick = { context.navigator.showRoot(AppTab.Today) }) { Text(stringResource(R.string.stats_go_to_today)) }
    }
}

/** Main's `StatsLine`: one quiet sentence under a page that says how its number moves. */
@Composable
internal fun StatsLine(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

private val PAGE_WIDTH = 960.dp
