package com.zoonk.android.app.shell

import androidx.compose.runtime.Composable
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator

/**
 * The tab roots' top app bar title: the goal switcher (main's goal menu), listing the active goals
 * and open quick explanations, New goal and Explore courses. Empty until the learner summary
 * exists to fill it, as main keeps neutral placeholders while the summary is unread.
 */
@Composable
fun GoalSwitcher(
    app: AppContainer,
    navigator: AppNavigator,
) {
}
