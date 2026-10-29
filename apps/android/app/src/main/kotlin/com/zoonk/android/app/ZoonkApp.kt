package com.zoonk.android.app

import androidx.annotation.DrawableRes
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DrawerDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarDefaults
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailDefaults
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.PermanentDrawerSheet
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.WindowAdaptiveInfo
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.adaptive.navigation3.rememberListDetailSceneStrategy
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffoldDefaults
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffoldLayout
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteType
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.ui.NavDisplay
import androidx.navigation3.ui.defaultPopTransitionSpec
import androidx.navigation3.ui.defaultTransitionSpec
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.buddy.BuddyTabIcon
import com.zoonk.android.feature.buddy.buddyTabMissions
import com.zoonk.android.feature.search.SearchHost
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppSection
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.navigation.LearnerAccess
import com.zoonk.android.navigation.PlaceIcon
import com.zoonk.android.navigation.StudyPlace
import com.zoonk.android.navigation.appEntries
import com.zoonk.android.navigation.gatedEntries
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.navigation.rememberEntries
import com.zoonk.android.navigation.section
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryPlaces

/**
 * The window's snackbars (main's toasts), shown by the shell or, over a task, by its scaffold.
 * Outside the shell (previews, tests) nothing shows them.
 */
val LocalSnackbarHostState = staticCompositionLocalOf { SnackbarHostState() }

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

@Composable
fun ZoonkApp(
    app: AppContainer,
    link: AppRoute? = null,
    onLinkOpened: () -> Unit = {},
    navigator: AppNavigator = rememberAppNavigator(),
) {
    val access = app.learnerAccess.collectAsStateWithLifecycle()
    val summary by app.learnerSummary.summary.collectShown()
    val entryProvider = remember(app, navigator) { gatedEntries(appEntries(app, navigator), access, app, navigator) }
    val session =
        app.sessions.state
            .collectAsStateWithLifecycle()
            .value as? SessionState.SignedIn
    var shownAccountId by rememberSaveable { mutableStateOf<String?>(null) }
    var shownGuest by rememberSaveable { mutableStateOf(false) }

    // As main reloads its tabs when someone signs in: another learner's screens aren't theirs.
    LaunchedEffect(session?.session?.accountId) {
        val learner = session ?: return@LaunchedEffect
        if (startsAnotherLearner(shownAccountId, shownGuest, learner)) navigator.popToRoots()
        shownAccountId = learner.session.accountId
        shownGuest = learner.isGuest
    }

    LaunchedEffect(link) {
        if (link != null) {
            navigator.openLink(link)
            onLinkOpened()
        }
    }

    val signedIn = access.value == LearnerAccess.SignedIn || access.value == LearnerAccess.NoGoal || access.value == LearnerAccess.Learner

    val snackbars = remember { SnackbarHostState() }

    // Search opens over any page, so it shares the frame's snackbars.
    CompositionLocalProvider(LocalSnackbarHostState provides snackbars) {
        SearchHost(app, navigator, signedIn) {
            AppShell(navigator, entryProvider, summary = summary.value.takeIf { signedIn }, snackbarHostState = snackbars)
        }
    }
}

/** A guest who signs in brings their work into the account, so only that change keeps the screens open. */
internal fun startsAnotherLearner(
    shownAccountId: String?,
    shownGuest: Boolean,
    next: SessionState.SignedIn,
): Boolean = shownAccountId != null && shownAccountId != next.session.accountId && !(shownGuest && !next.isGuest)

@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun AppShell(
    navigator: AppNavigator,
    entryProvider: (NavKey) -> NavEntry<NavKey>,
    modifier: Modifier = Modifier,
    summary: LearnerSummary? = null,
    snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
) {
    val snackbarAnchors = remember { SnackbarAnchors() }
    val entries = navigator.rememberEntries(entryProvider)
    val navigationSuiteType = navigationSuiteType(currentWindowAdaptiveInfoV2(), navigator)

    CompositionLocalProvider(LocalSnackbarHostState provides snackbarHostState, LocalSnackbarAnchors provides snackbarAnchors) {
        Surface(modifier = modifier) {
            NavigationSuiteScaffoldLayout(
                navigationSuite = { AppNavigationSuite(navigator, navigationSuiteType, summary) },
                navigationSuiteType = navigationSuiteType,
            ) {
                var contentBottom by remember { mutableFloatStateOf(0f) }

                Box(
                    Modifier
                        .consumeWindowInsets(navigationSuiteInsets(navigationSuiteType))
                        .onGloballyPositioned { contentBottom = it.boundsInRoot().bottom },
                ) {
                    NavDisplay(
                        entries = entries,
                        sceneStrategies = listOf(rememberListDetailSceneStrategy()),
                        transitionSpec = {
                            if (navigator.isSwitchingTabs) NO_TRANSITION else defaultTransitionSpec<NavKey>()(this)
                        },
                        popTransitionSpec = {
                            if (navigator.isSwitchingTabs) NO_TRANSITION else defaultPopTransitionSpec<NavKey>()(this)
                        },
                        onBack = { navigator.back() },
                    )

                    // A task's scaffold shows them over its action bar instead.
                    if (!navigator.isTaskOpen) {
                        ShellSnackbarHost(snackbarHostState, snackbarAnchors, { contentBottom }, Modifier.align(Alignment.BottomCenter))
                    }
                }
            }
        }
    }
}

@Composable
private fun ShellSnackbarHost(
    hostState: SnackbarHostState,
    anchors: SnackbarAnchors,
    contentBottom: () -> Float,
    modifier: Modifier = Modifier,
) {
    val anchorTop = anchors.highest
    val lift =
        if (anchorTop == null) {
            Modifier.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom))
        } else {
            Modifier.padding(bottom = with(LocalDensity.current) { (contentBottom() - anchorTop).coerceAtLeast(0f).toDp() })
        }

    SnackbarHost(
        hostState = hostState,
        modifier = modifier.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal)).then(lift),
    )
}

/** A tab switch shows the other tab at once, as everyday screens stay still. */
private val NO_TRANSITION = ContentTransform(EnterTransition.None, ExitTransition.None)

/**
 * Material's choice for the window (a bar on compact windows and tabletop, a rail on medium
 * ones), with a drawer where an expanded window has the height for one. Tasks hide it, and so
 * does onboarding where there's no drawer, as main hides its tab bar under `lg`.
 */
private fun navigationSuiteType(
    adaptiveInfo: WindowAdaptiveInfo,
    navigator: AppNavigator,
): NavigationSuiteType {
    val sizeClass = adaptiveInfo.windowSizeClass
    val default = NavigationSuiteScaffoldDefaults.calculateFromAdaptiveInfo(adaptiveInfo)
    val type =
        if (default == NavigationSuiteType.NavigationRail &&
            sizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND) &&
            sizeClass.isHeightAtLeastBreakpoint(WindowSizeClass.HEIGHT_DP_MEDIUM_LOWER_BOUND)
        ) {
            NavigationSuiteType.NavigationDrawer
        } else {
            default
        }

    return when {
        navigator.isTaskOpen -> NavigationSuiteType.None
        navigator.currentRoute.section == AppSection.Onboarding && type != NavigationSuiteType.NavigationDrawer -> NavigationSuiteType.None
        else -> type
    }
}

/** The insets the navigation container already pads for, so the pages beside it don't again. */
@Composable
private fun navigationSuiteInsets(navigationSuiteType: NavigationSuiteType): WindowInsets =
    when (navigationSuiteType) {
        NavigationSuiteType.NavigationBar -> NavigationBarDefaults.windowInsets.only(WindowInsetsSides.Bottom)
        NavigationSuiteType.NavigationRail -> NavigationRailDefaults.windowInsets.only(WindowInsetsSides.Start)
        NavigationSuiteType.NavigationDrawer -> DrawerDefaults.windowInsets.only(WindowInsetsSides.Start)
        else -> WindowInsets(0)
    }

/** As main's sidebar does, the drawer marks a Study place's page with the place, not its tab. */
@Composable
private fun AppNavigationSuite(
    navigator: AppNavigator,
    navigationSuiteType: NavigationSuiteType,
    summary: LearnerSummary?,
) {
    val route = navigator.currentRoute
    val missions = buddyTabMissions(summary?.missions)

    when (navigationSuiteType) {
        NavigationSuiteType.NavigationBar -> {
            NavigationBar {
                AppTab.entries.forEach { tab ->
                    val isSelected = tab == navigator.selectedTab

                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { navigator.select(tab) },
                        icon = { TabIcon(tab, isSelected, summary) },
                        modifier = Modifier.missionsState(tab, missions),
                        label = { Text(tab.title(summary)) },
                    )
                }
            }
        }

        NavigationSuiteType.NavigationRail -> {
            NavigationRail {
                AppTab.entries.forEach { tab ->
                    val isSelected = tab == navigator.selectedTab

                    NavigationRailItem(
                        selected = isSelected,
                        onClick = { navigator.select(tab) },
                        icon = { TabIcon(tab, isSelected, summary) },
                        modifier = Modifier.missionsState(tab, missions),
                        label = { Text(tab.title(summary)) },
                    )
                }
            }
        }

        NavigationSuiteType.NavigationDrawer -> {
            val shownPlace = StudyPlace.entries.firstOrNull { it.isShowing(route) }

            PermanentDrawerSheet {
                Column(
                    modifier =
                        Modifier
                            .verticalScroll(rememberScrollState())
                            .padding(vertical = 12.dp),
                ) {
                    AppTab.entries.forEach { tab ->
                        val isSelected = tab == navigator.selectedTab && shownPlace == null
                        // Main counts the day's activities left in its sidebar only; a bar would show it as an alert.
                        val badge = if (tab == AppTab.Today) summary?.today?.blocksLeft else null

                        DrawerItem(
                            label = tab.title(summary),
                            icon = { TabIcon(tab, isSelected, summary) },
                            selected = isSelected,
                            badge = badge,
                            modifier = Modifier.missionsState(tab, missions),
                        ) { navigator.select(tab) }
                    }

                    Text(
                        text = stringResource(R.string.navigation_study),
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier =
                            Modifier
                                .padding(start = 28.dp, end = 28.dp, top = 16.dp, bottom = 8.dp)
                                .semantics { heading() },
                    )

                    StudyPlace.entries.filter { it.isListed(summary?.places) }.forEach { place ->
                        val isSelected = place == shownPlace
                        val badge = if (place == StudyPlace.Mistakes) summary?.places?.readyMistakes else null

                        DrawerItem(stringResource(place.label), { NavigationIcon(place.icon.drawable(isSelected)) }, isSelected, badge) {
                            navigator.open(place.route)
                        }
                    }
                }
            }
        }

        else -> {}
    }
}

@Composable
private fun DrawerItem(
    label: String,
    icon: @Composable () -> Unit,
    selected: Boolean,
    badge: Long?,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    NavigationDrawerItem(
        label = { Text(label) },
        selected = selected,
        onClick = onClick,
        icon = icon,
        badge = badge?.takeIf { it > 0 }?.let { count -> { Text(formatNumber(count.toDouble(), currentLocale())) } },
        modifier = modifier.padding(NavigationDrawerItemDefaults.ItemPadding),
    )
}

/** The buddy's tab carries the name the learner gave it. */
@Composable
private fun AppTab.title(summary: LearnerSummary?): String = summary?.buddy?.name?.takeIf { this == AppTab.Buddy } ?: stringResource(label)

/** Exam, Speaking and Mind maps are listed only for a goal that has them. */
private fun StudyPlace.isListed(places: LearnerSummaryPlaces?): Boolean =
    when (this) {
        StudyPlace.Exam -> places?.exam == true
        StudyPlace.Speaking -> places?.speaking == true
        StudyPlace.MindMaps -> places?.mindMaps == true
        StudyPlace.Mistakes, StudyPlace.Statistics -> true
    }

private fun PlaceIcon.drawable(selected: Boolean) = if (selected) selectedIcon else icon

/** The buddy's tab wears the learner's buddy once the summary says which it is. */
@Composable
private fun TabIcon(
    tab: AppTab,
    selected: Boolean,
    summary: LearnerSummary?,
) {
    val buddy = summary?.buddy
    if (tab == AppTab.Buddy && buddy != null) BuddyTabIcon(buddy, summary.missions) else NavigationIcon(tab.icon.drawable(selected))
}

/** Material's items hide their icon from TalkBack, so the item itself says the missions after its name, as main does. */
private fun Modifier.missionsState(
    tab: AppTab,
    missions: String?,
): Modifier = if (tab == AppTab.Buddy && missions != null) semantics { stateDescription = missions } else this

/** Navigation icons are decorative: the item's label names the destination. */
@Composable
private fun NavigationIcon(
    @DrawableRes icon: Int,
) {
    Icon(painterResource(icon), contentDescription = null)
}
