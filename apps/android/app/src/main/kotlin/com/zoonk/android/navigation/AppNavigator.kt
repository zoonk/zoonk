package com.zoonk.android.navigation

import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.Stable
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.rememberDecoratedNavEntries
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator

/**
 * One window's navigation, and the only way features navigate (Apple's `AppRouter`): a back stack
 * per tab, kept across tab switches; the selected tab; and the full-screen tasks over the frame.
 */
@Stable
class AppNavigator internal constructor(
    private val stacks: Map<AppTab, NavBackStack<NavKey>>,
    private val selected: MutableState<AppTab>,
    internal val tasks: NavBackStack<NavKey>,
    private val openWebPage: (AppRoute.WebPage) -> Unit,
) {
    val selectedTab: AppTab
        get() = selected.value

    val currentRoute: AppRoute
        get() = (tasks.lastOrNull() ?: currentStack.last()) as AppRoute

    val isTaskOpen: Boolean
        get() = tasks.isNotEmpty()

    internal var isSwitchingTabs = false
        private set

    private val currentStack: NavBackStack<NavKey>
        get() = stack(selectedTab)

    internal fun stack(tab: AppTab): NavBackStack<NavKey> = stacks.getValue(tab)

    /** Shows a tab where the learner left it, closing any task; the selected tab goes back to its root. */
    fun select(tab: AppTab) {
        tasks.clear()

        if (tab == selectedTab) {
            popTo(currentStack, size = 1)
        } else {
            selected.value = tab
        }

        isSwitchingTabs = true
    }

    /**
     * Opens a route where it belongs: a tab's root on its tab; a page or a section's page on the
     * current tab, after closing any task (so a lesson's "See the plan" lands on the stack); a task
     * over everything; a web page in a Custom Tab. A route already open is gone back to, not stacked
     * again.
     */
    fun open(route: AppRoute) {
        when (val presentation = route.presentation) {
            is Presentation.Tab -> {
                showRoot(presentation.tab, root = route)
            }

            Presentation.Push, is Presentation.Section -> {
                tasks.clear()
                push(currentStack, route)
            }

            Presentation.Task -> {
                push(tasks, route)
            }

            Presentation.Web -> {
                openWebPage(route as AppRoute.WebPage)
            }
        }

        isSwitchingTabs = false
    }

    /**
     * Opens the task `route` with the task `beneath` under it, in one step: closing `route` shows
     * `beneath`, such as a lesson opened from the session, which goes on after it.
     */
    fun openOver(
        route: AppRoute,
        beneath: AppRoute,
    ) {
        push(tasks, beneath)
        push(tasks, route)
        isSwitchingTabs = false
    }

    /**
     * Opens a link from outside the app (App Links): a page on a fresh stack of its tab (the tab's
     * root, then the page), so back leads where the page belongs; a task over the frame.
     */
    fun openLink(route: AppRoute) {
        when (route.presentation) {
            is Presentation.Tab, Presentation.Task, Presentation.Web -> {
                open(route)
            }

            Presentation.Push, is Presentation.Section -> {
                showRoot(route.homeTab)
                currentStack.add(route)
            }
        }

        isSwitchingTabs = false
    }

    /**
     * Back, as the system's back does: the top task, else the tab's top page, else from another
     * tab's root to Today, whose root leaves the app. False when there's nothing left to go back to.
     */
    fun back(): Boolean {
        val stack = currentStack

        when {
            tasks.isNotEmpty() -> tasks.removeAt(tasks.lastIndex)
            stack.size > 1 -> stack.removeAt(stack.lastIndex)
            selectedTab != AppTab.Today -> selected.value = AppTab.Today
            else -> return false
        }

        isSwitchingTabs = false
        return true
    }

    fun closeTask() {
        if (tasks.isNotEmpty()) {
            tasks.removeAt(tasks.lastIndex)
        }

        isSwitchingTabs = false
    }

    /**
     * Leaves the section on top (settings, statistics, the catalog, onboarding) as a whole, back to
     * the page it was opened from, however deep the learner went in it.
     */
    fun closeSection() {
        val stack = currentStack
        val section = (stack.last() as AppRoute).section ?: return

        popTo(stack, size = stack.indexOfLast { (it as AppRoute).section != section } + 1)
        isSwitchingTabs = false
    }

    /** Shows a tab at its root, closing any task: where "Start a goal" and a finished sign-in lead. */
    fun showRoot(
        tab: AppTab,
        root: AppRoute = tab.root,
    ) {
        val stack = stack(tab)

        tasks.clear()
        selected.value = tab
        popTo(stack, size = 1)

        if (stack.first() != root) {
            stack[0] = root
        }

        isSwitchingTabs = false
    }

    /** Drops every page and task, for another learner or goal: what they showed belonged to the previous one. */
    fun popToRoots() {
        tasks.clear()
        AppTab.entries.forEach { tab -> popTo(stack(tab), size = 1) }
        isSwitchingTabs = false
    }

    private fun push(
        stack: NavBackStack<NavKey>,
        route: AppRoute,
    ) {
        val index = stack.indexOf(route)

        if (index >= 0) {
            popTo(stack, size = index + 1)
        } else {
            stack.add(route)
        }
    }

    private fun popTo(
        stack: NavBackStack<NavKey>,
        size: Int,
    ) {
        while (stack.size > size) {
            stack.removeAt(stack.lastIndex)
        }
    }
}

/** The window's navigator, its stacks and selected tab saved across recreation and process death. */
@Composable
fun rememberAppNavigator(): AppNavigator {
    val context = LocalContext.current
    val today = rememberNavBackStack(AppTab.Today.root)
    val plan = rememberNavBackStack(AppTab.Plan.root)
    val buddy = rememberNavBackStack(AppTab.Buddy.root)
    val tasks = rememberNavBackStack()
    val selected = rememberSaveable { mutableStateOf(AppTab.Today) }

    return remember(today, plan, buddy, tasks, selected, context) {
        AppNavigator(
            stacks = mapOf(AppTab.Today to today, AppTab.Plan to plan, AppTab.Buddy to buddy),
            selected = selected,
            tasks = tasks,
            openWebPage = { page ->
                val language =
                    context.resources.configuration.locales[0]
                        .language
                CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(AppLink.webUrl(page, language)))
            },
        )
    }
}

/**
 * What the shell's display shows, decorated per stack so each entry keeps its saved state and
 * ViewModels while it's on its stack, shown or not: Today's stack, the selected tab's above it (so
 * back from another tab's root leads to Today), then the tasks.
 */
@Composable
internal fun AppNavigator.rememberEntries(entryProvider: (NavKey) -> NavEntry<NavKey>): List<NavEntry<NavKey>> {
    val tabEntries = AppTab.entries.associateWith { tab -> key(tab) { rememberStackEntries(stack(tab), tab.name, entryProvider) } }
    val taskEntries = key("tasks") { rememberStackEntries(tasks, "tasks", entryProvider) }
    val selectedEntries = if (selectedTab == AppTab.Today) emptyList() else tabEntries.getValue(selectedTab)

    return tabEntries.getValue(AppTab.Today) + selectedEntries + taskEntries
}

/**
 * One stack's entries, their content keys scoped to the stack: the same page can be open on two
 * tabs, and each keeps its own state.
 */
@Composable
private fun rememberStackEntries(
    stack: NavBackStack<NavKey>,
    scope: String,
    entryProvider: (NavKey) -> NavEntry<NavKey>,
): List<NavEntry<NavKey>> {
    val scopedProvider =
        remember(scope, entryProvider) {
            { key: NavKey ->
                val entry = entryProvider(key)
                NavEntry(key, contentKey = "$scope/${entry.contentKey}", metadata = entry.metadata) { entry.Content() }
            }
        }

    return rememberDecoratedNavEntries(
        backStack = stack,
        entryDecorators =
            listOf(
                rememberSaveableStateHolderNavEntryDecorator(),
                rememberViewModelStoreNavEntryDecorator(),
            ),
        entryProvider = scopedProvider,
    )
}
