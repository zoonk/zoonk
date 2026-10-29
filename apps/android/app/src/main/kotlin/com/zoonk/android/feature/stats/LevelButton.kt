package com.zoonk.android.feature.stats

import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.semantics
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Belt
import com.zoonk.android.ui.components.BeltLevel

/** The tab roots' belt and level (main's `LevelLink`), which open Statistics; nothing until the summary says them. */
@Composable
fun LevelButton(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val level = summary.value?.level ?: return
    val belt = Belt.entries.first { it.name.equals(level.color.value, ignoreCase = true) }
    val open = { navigator.open(AppRoute.Statistics) }
    val action = stringResource(R.string.stats_open)

    TextButton(
        onClick = open,
        modifier =
            Modifier.semantics {
                onClick(label = action) {
                    open()
                    true
                }
            },
    ) {
        BeltLevel(belt, level.level.toInt())
    }
}
