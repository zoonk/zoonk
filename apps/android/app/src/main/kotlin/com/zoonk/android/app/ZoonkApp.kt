package com.zoonk.android.app

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.ui.NavDisplay
import androidx.navigation3.ui.defaultPopTransitionSpec
import androidx.navigation3.ui.defaultTransitionSpec
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.data.collectShown
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppSection
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.navigation.PlaceIcon
import com.zoonk.android.navigation.StudyPlace
import com.zoonk.android.navigation.appEntries
import com.zoonk.android.navigation.gatedEntries
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.navigation.rememberEntries
import com.zoonk.android.navigation.section

/**
 * The window's snackbars (main's toasts), shown by the shell or, over a task, by its scaffold.
 * Outside the shell (previews, tests) nothing shows them.
 */
val LocalSnackbarHostState = staticCompositionLocalOf { SnackbarHostState() }

@Composable
fun ZoonkApp(
    app: AppContainer,
    link: AppRoute? = null,
    onLinkOpened: () -> Unit = {},
    navigator: AppNavigator = rememberAppNavigator(),
) {
    val access = app.learnerAccess.collectAsStateWithLifecycle()
    app.learnerSummary.summary.collectShown()
    val entryProvider = remember(app, navigator) { gatedEntries(appEntries(app, navigator), access, app, navigator) }

    LaunchedEffect(link) {
        if (link != null) {
            navigator.openLink(link)
            onLinkOpened()
        }
    }

    AppShell(navigator, entryProvider)
}

@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun AppShell(
    navigator: AppNavigator,
    entryProvider: (NavKey) -> NavEntry<NavKey>,
    modifier: Modifier = Modifier,
) {
    val snackbarHostState = remember { SnackbarHostState() }
    val entries = navigator.rememberEntries(entryProvider)
    val navigationSuiteType = navigationSuiteType(currentWindowAdaptiveInfoV2(), navigator)

    CompositionLocalProvider(LocalSnackbarHostState provides snackbarHostState) {
        Surface(modifier = modifier) {
            NavigationSuiteScaffoldLayout(
                navigationSuite = { AppNavigationSuite(navigator, navigationSuiteType) },
                navigationSuiteType = navigationSuiteType,
            ) {
                Box(Modifier.consumeWindowInsets(navigationSuiteInsets(navigationSuiteType))) {
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
                        SnackbarHost(
                            hostState = snackbarHostState,
                            modifier =
                                Modifier
                                    .align(Alignment.BottomCenter)
                                    .windowInsetsPadding(
                                        WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal),
                                    ),
                        )
                    }
                }
            }
        }
    }
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
) {
    val route = navigator.currentRoute

    when (navigationSuiteType) {
        NavigationSuiteType.NavigationBar -> {
            NavigationBar {
                AppTab.entries.forEach { tab ->
                    val isSelected = tab == navigator.selectedTab

                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { navigator.select(tab) },
                        icon = { NavigationIcon(tab.icon.drawable(isSelected)) },
                        label = { Text(stringResource(tab.label)) },
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
                        icon = { NavigationIcon(tab.icon.drawable(isSelected)) },
                        label = { Text(stringResource(tab.label)) },
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

                        DrawerItem(tab.label, tab.icon.drawable(isSelected), isSelected) { navigator.select(tab) }
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

                    StudyPlace.entries.forEach { place ->
                        val isSelected = place == shownPlace

                        DrawerItem(place.label, place.icon.drawable(isSelected), isSelected) {
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
    @StringRes label: Int,
    @DrawableRes icon: Int,
    selected: Boolean,
    onClick: () -> Unit,
) {
    NavigationDrawerItem(
        label = { Text(stringResource(label)) },
        selected = selected,
        onClick = onClick,
        icon = { NavigationIcon(icon) },
        modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding),
    )
}

private fun PlaceIcon.drawable(selected: Boolean) = if (selected) selectedIcon else icon

/** Navigation icons are decorative: the item's label names the destination. */
@Composable
private fun NavigationIcon(
    @DrawableRes icon: Int,
) {
    Icon(painterResource(icon), contentDescription = null)
}
