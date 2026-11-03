package com.zoonk.android.feature.certificates

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

fun EntryProviderScope<NavKey>.certificatesEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Certificates> { CertificatesScreen(app, navigator) }
    entry<AppRoute.Certificate> { route -> CertificateScreen(route.code, app, navigator) }
}
