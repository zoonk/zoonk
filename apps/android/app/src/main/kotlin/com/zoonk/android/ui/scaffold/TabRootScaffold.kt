package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.shell.GoalSwitcher
import com.zoonk.android.feature.account.AccountMenu
import com.zoonk.android.feature.search.TabSearchBar
import com.zoonk.android.feature.stats.LevelButton
import com.zoonk.android.navigation.AppNavigator

/**
 * A tab's own page (Today, the Plan, the buddy): main's app bar as its top app bar, with the goal
 * switcher, the belt and level that lead to Statistics and the account menu, and search under it.
 * Pages a tab opens have their own top app bar with the way back instead.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TabRootScaffold(
    app: AppContainer,
    navigator: AppNavigator,
    modifier: Modifier = Modifier,
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            Column {
                TopAppBar(
                    title = { GoalSwitcher(app, navigator) },
                    actions = {
                        LevelButton(app, navigator)
                        AccountMenu(app, navigator)
                    },
                )
                TabSearchBar(app, navigator)
            }
        },
        content = content,
    )
}
