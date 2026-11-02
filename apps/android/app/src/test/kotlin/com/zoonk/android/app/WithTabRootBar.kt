package com.zoonk.android.app

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.scaffold.LocalTabRootBar

/** For a tab root shown outside the shell: its app bar, as [ZoonkApp] provides it. */
@Composable
fun WithTabRootBar(
    app: AppContainer,
    navigator: AppNavigator,
    content: @Composable () -> Unit,
) = CompositionLocalProvider(LocalTabRootBar provides rememberTabRootBar(app, navigator), content = content)
