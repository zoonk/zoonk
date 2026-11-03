package com.zoonk.android.app

import androidx.annotation.DrawableRes
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DrawerDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.WindowAdaptiveInfo
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.adaptive.layout.AnimatedPane
import androidx.compose.material3.adaptive.layout.ListDetailPaneScaffold
import androidx.compose.material3.adaptive.layout.PaneAdaptedValue
import androidx.compose.material3.adaptive.layout.ThreePaneScaffoldValue
import androidx.compose.material3.adaptive.navigation3.ListDetailSceneStrategy
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
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.UriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.scene.SceneStrategy
import androidx.navigation3.ui.NavDisplay
import androidx.navigation3.ui.defaultPopTransitionSpec
import androidx.navigation3.ui.defaultTransitionSpec
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.app.shell.GoalSwitcher
import com.zoonk.android.data.LocalEventTracker
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.account.AccountMenu
import com.zoonk.android.feature.buddy.BuddyTabIcon
import com.zoonk.android.feature.buddy.buddyTabMissions
import com.zoonk.android.feature.feedback.rememberSendFeedback
import com.zoonk.android.feature.search.SearchHost
import com.zoonk.android.feature.search.TabSearchBar
import com.zoonk.android.feature.search.rememberTabSearchScroll
import com.zoonk.android.feature.stats.LevelButton
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
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.PrivatePictures
import com.zoonk.android.ui.components.SnackbarHost
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.LocalShownOnTop
import com.zoonk.android.ui.scaffold.LocalTabRootBar
import com.zoonk.android.ui.scaffold.PageSpan
import com.zoonk.android.ui.scaffold.TabRootBar
import com.zoonk.android.ui.scaffold.onPageSpan
import com.zoonk.android.ui.scaffold.pageDirective
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryPlaces

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
    val session by app.sessions.state.collectAsStateWithLifecycle()
    var shown by rememberSaveable(stateSaver = ShownLearner.Saver) { mutableStateOf(ShownLearner()) }

    // As main reloads its tabs when someone signs in: another learner's screens aren't theirs.
    LaunchedEffect(session) {
        val current = session
        if (current is SessionState.SignedIn && shown.startsAnother(current)) navigator.popToRoots(keeping = AppRoute.Login)
        shown = shown.after(current)
    }

    LaunchedEffect(link) {
        if (link != null) {
            navigator.openLink(link)
            onLinkOpened()
        }
    }

    val signedIn = access.value == LearnerAccess.SignedIn || access.value == LearnerAccess.NoGoal || access.value == LearnerAccess.Learner

    val snackbars = rememberWindowSnackbars(app)

    val pictures = remember(session) { PrivatePictures(app.images, (session as? SessionState.SignedIn)?.session) }

    // Search opens over any page, so it shares the frame's snackbars.
    val context = LocalContext.current
    // Text links with no handler of their own open through the same opener as every other link.
    val links =
        remember(context) {
            object : UriHandler {
                override fun openUri(uri: String) = openWebPage(context, uri)
            }
        }

    CompositionLocalProvider(
        LocalSnackbarHostState provides snackbars,
        LocalPrivatePictures provides pictures,
        LocalUriHandler provides links,
        LocalTabRootBar provides rememberTabRootBar(app, navigator),
        LocalEventTracker provides app.analytics,
    ) {
        val sendFeedback = rememberSendFeedback(app, "sidebar")

        SearchHost(app, navigator, signedIn) {
            AppShell(
                navigator,
                entryProvider,
                sendFeedback::open,
                summary = summary.value.takeIf { signedIn },
                snackbarHostState = snackbars,
            )
        }
    }
}

/** The tab roots' app bar: the goal switcher, level, account menu and search, which live above the tabs. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun rememberTabRootBar(
    app: AppContainer,
    navigator: AppNavigator,
): TabRootBar =
    remember(app, navigator) {
        TabRootBar(
            title = { GoalSwitcher(app, navigator) },
            actions = {
                LevelButton(app, navigator)
                AccountMenu(app, navigator)
            },
            search = { modifier -> TabSearchBar(app, navigator, modifier) },
            searchScroll = { rememberTabSearchScroll() },
        )
    }

/** The learner the window last showed, saved with it. */
internal data class ShownLearner(
    val accountId: String? = null,
    val guest: Boolean = false,
) {
    /** A guest who signs in brings their work into the account, so only that change keeps the screens open. */
    fun startsAnother(next: SessionState.SignedIn): Boolean =
        accountId != null && accountId != next.session.accountId && !(guest && !next.isGuest)

    /** A guest whose session ended brings nothing into the next account. */
    fun after(state: SessionState): ShownLearner =
        when (state) {
            is SessionState.SignedIn -> ShownLearner(state.session.accountId, state.isGuest)
            is SessionState.SignedOut -> copy(guest = false)
            else -> this
        }

    companion object {
        val Saver = listSaver<ShownLearner, Any?>({ listOf(it.accountId, it.guest) }, { ShownLearner(it[0] as String?, it[1] as Boolean) })
    }
}

@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun AppShell(
    navigator: AppNavigator,
    entryProvider: (NavKey) -> NavEntry<NavKey>,
    onSendFeedback: () -> Unit,
    modifier: Modifier = Modifier,
    summary: LearnerSummary? = null,
    snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
) {
    val snackbarAnchors = remember { SnackbarAnchors() }
    val entries =
        navigator.rememberEntries(
            remember(entryProvider, navigator) { { key: NavKey -> entryProvider(key).onItsOwn(key, entryProvider).onTop(key, navigator) } },
        )
    val navigationSuiteType = navigationSuiteType(currentWindowAdaptiveInfoV2(), navigator)

    CompositionLocalProvider(
        LocalSnackbarHostState provides snackbarHostState,
        LocalSnackbarAnchors provides snackbarAnchors,
        LocalNavigationSuiteType provides navigationSuiteType,
    ) {
        Surface(modifier = modifier) {
            NavigationSuiteScaffoldLayout(
                navigationSuite = { AppNavigationSuite(navigator, navigationSuiteType, summary, onSendFeedback) },
                navigationSuiteType = navigationSuiteType,
            ) {
                var contentBottom by remember { mutableFloatStateOf(0f) }

                BoxWithConstraints(
                    Modifier
                        .consumeWindowInsets(navigationSuiteInsets(navigationSuiteType))
                        .onGloballyPositioned { contentBottom = it.boundsInRoot().bottom },
                ) {
                    NavDisplay(
                        entries = entries,
                        // A list and its detail split as a page and its aside do, so they meet at an unfolded book's fold.
                        sceneStrategies = listOf(listLed(rememberListDetailSceneStrategy(directive = pageDirective(maxWidth)))),
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

/**
 * Material's list-detail scene where a list leads it. A detail opened on its own (Subscription from
 * the account menu) is a page of its own: Material would lay it beside an empty list.
 */
private fun <T : Any> listLed(listDetail: SceneStrategy<T>): SceneStrategy<T> =
    SceneStrategy { entries ->
        val panes = entries.takeLastWhile { PANE_ROLE in it.metadata }
        if (panes.any { it.metadata[PANE_ROLE]?.javaClass == LIST_ROLE }) with(listDetail) { calculateScene(entries) } else null
    }

/**
 * A list or its detail shown on its own, where only one pane fits (as with large text) or for a
 * detail opened on its own (Help from the account menu), which Navigation 3 shows across the window.
 * Across an unfolded book's fold a settings page faces the settings list, as main shows its settings
 * tabs over every settings page, and anything else keeps to the page before the fold, as other
 * one-column screens do. Beside each other, the fold crosses neither.
 */
private fun NavEntry<NavKey>.onItsOwn(
    key: NavKey,
    entryProvider: (NavKey) -> NavEntry<NavKey>,
): NavEntry<NavKey> {
    if (PANE_ROLE !in metadata) return this
    val entry = this
    val hub = AppRoute.Settings.takeIf { key != it && (key as? AppRoute)?.section == AppSection.Settings }

    return NavEntry(key, contentKey, metadata) {
        if (hub == null) {
            BeforeFold { beforeFold -> Box(beforeFold.fillMaxSize()) { entry.Content() } }
        } else {
            val list = remember { entryProvider(hub) }
            BesideItsListAtFold(list = { CompositionLocalProvider(LocalShownOnTop provides false) { list.Content() } }) { entry.Content() }
        }
    }
}

/** The screen the learner went to last, whose title takes their focus; switching tabs leaves it on the tab. */
private fun NavEntry<NavKey>.onTop(
    key: NavKey,
    navigator: AppNavigator,
): NavEntry<NavKey> {
    val entry = this
    return NavEntry(key, contentKey, metadata) {
        CompositionLocalProvider(LocalShownOnTop provides (navigator.currentRoute == key && !navigator.isSwitchingTabs)) { entry.Content() }
    }
}

/** [detail] keeps one place whether or not [list] shows beside it, so what it holds stays as the book opens or closes. */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
private fun BesideItsListAtFold(
    list: @Composable () -> Unit,
    detail: @Composable () -> Unit,
) {
    var span by remember { mutableStateOf<PageSpan?>(null) }

    BoxWithConstraints(Modifier.onPageSpan { span = it }) {
        val directive = pageDirective(maxWidth, span, atFoldOnly = true)

        ListDetailPaneScaffold(
            directive = directive,
            value =
                ThreePaneScaffoldValue(
                    primary = PaneAdaptedValue.Expanded,
                    secondary = if (directive.maxHorizontalPartitions > 1) PaneAdaptedValue.Expanded else PaneAdaptedValue.Hidden,
                    tertiary = PaneAdaptedValue.Hidden,
                ),
            listPane = { AnimatedPane { list() } },
            detailPane = { AnimatedPane { detail() } },
        )
    }
}

// Material keeps its pane roles' metadata types to itself, so its list's are read off listPane().
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
private val LIST_METADATA = ListDetailSceneStrategy.listPane()
private val PANE_ROLE = LIST_METADATA.keys.single()
private val LIST_ROLE = LIST_METADATA.values.single().javaClass

/** A tab switch shows the other tab at once, as everyday screens stay still. */
private val NO_TRANSITION = ContentTransform(EnterTransition.None, ExitTransition.None)

/**
 * Material's choice for the window (a bar on compact windows and tabletop, a rail elsewhere), with
 * a drawer where a large window has the height for one and still leaves two panes beside it: on an
 * unfolded foldable a drawer would take most of the fold's first side. Tasks hide it, and so does
 * onboarding where there's no drawer, as main hides its tab bar under `lg`.
 */
private fun navigationSuiteType(
    adaptiveInfo: WindowAdaptiveInfo,
    navigator: AppNavigator,
): NavigationSuiteType {
    val sizeClass = adaptiveInfo.windowSizeClass
    val default = NavigationSuiteScaffoldDefaults.calculateFromAdaptiveInfo(adaptiveInfo)
    val type =
        if (default == NavigationSuiteType.NavigationRail &&
            sizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_LARGE_LOWER_BOUND) &&
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
    onSendFeedback: () -> Unit,
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
                            .weight(1f)
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

                DrawerAction(
                    stringResource(R.string.feedback_send_feedback),
                    R.drawable.ic_feedback,
                    Modifier.padding(bottom = 12.dp),
                    onSendFeedback,
                )
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

/** A drawer row that opens something over the page rather than a place, so it reads as a button, not a tab. */
@Composable
private fun DrawerAction(
    label: String,
    @DrawableRes icon: Int,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        modifier =
            modifier
                .padding(NavigationDrawerItemDefaults.ItemPadding)
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .semantics { role = Role.Button },
        shape = CircleShape,
        color = Color.Transparent,
        contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
    ) {
        Row(
            Modifier.padding(start = 16.dp, end = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            NavigationIcon(icon)
            Text(label)
        }
    }
}

/** The buddy's tab carries the name the learner gave it. */
@Composable
private fun AppTab.title(summary: LearnerSummary?): String {
    if (this != AppTab.Buddy) return stringResource(label)
    val buddy = summary?.buddy
    return buddyName(buddy?.kind?.let { BuddyKind.of(it.value) } ?: BuddyKind.Zu, buddy?.name)
}

/** Exam, Speaking, Mind maps and Completed lessons are listed only for a goal that has them; Certificates once there's one. */
private fun StudyPlace.isListed(places: LearnerSummaryPlaces?): Boolean =
    when (this) {
        StudyPlace.CompletedLessons -> places?.completedLessons == true
        StudyPlace.Certificates -> places?.certificates == true
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
