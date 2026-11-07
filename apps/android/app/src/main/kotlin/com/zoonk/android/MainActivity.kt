package com.zoonk.android

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.annotation.VisibleForTesting
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.zoonk.android.app.ZoonkApp
import com.zoonk.android.app.ZoonkApplication
import com.zoonk.android.data.shownLocale
import com.zoonk.android.data.value
import com.zoonk.android.feature.reminders.reminderGoalId
import com.zoonk.android.navigation.AppLink
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private var pendingLink by mutableStateOf<AppRoute?>(null)

    // A device language Zoonk lacks stays first in Android's configuration while the strings fall back
    // to English, so dates, language names and plurals would follow that language inside English copy.
    @SuppressLint("AppBundleLocaleChanges") // It picks the device's language whose split Play installed, or the base's English.
    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(newBase)
        applyOverrideConfiguration(Configuration().apply { setLocale(newBase.resources.configuration.shownLocale()) })
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // A recreation in this process (a rotation or a resize) already opened its link, and so did a
        // return from Recents, which hands back the original intent. Only a new launch after a restart
        // brings a link to open over the restored stacks.
        val fromHistory = intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY != 0
        if (!fromHistory && (savedInstanceState == null || !createdInThisProcess)) {
            pendingLink = intent.appLink()
            openReminder(intent)
        }
        createdInThisProcess = true

        val container = (application as ZoonkApplication).container
        handleAppleLink(intent)

        setContent {
            ZoonkTheme {
                ZoonkApp(app = container, link = pendingLink, onLinkOpened = { pendingLink = null })
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleAppleLink(intent)
        intent.appLink()?.let { pendingLink = it }
        openReminder(intent)
    }

    override fun onStart() {
        super.onStart()
        (application as ZoonkApplication).container.push.opened()
    }

    /**
     * A tapped reminder opens Today on the goal it named, the learner's tap making it the active goal;
     * a switch that fails leaves Today on the active goal.
     */
    private fun openReminder(intent: Intent) {
        val goalId = intent.reminderGoalId() ?: return
        val app = (application as ZoonkApplication).container
        pendingLink = AppRoute.Today
        val active =
            app.learnerSummary.summary.state.value.value
                ?.activeGoalId
        if (active != goalId) app.scope.launch { app.switchGoal(goalId) }
    }

    private fun handleAppleLink(intent: Intent) {
        if (intent.action != Intent.ACTION_VIEW) return
        val callback = intent.dataString?.let(AppLink::appleCallback) ?: return
        val container = (application as ZoonkApplication).container
        container.scope.launch {
            val sessions = container.sessions
            sessions.restore()
            sessions.completeAppleSignIn(callback)
        }
    }
}

/** Whether this process has created the activity before, unlike one Android started to restore it. */
@VisibleForTesting
internal var createdInThisProcess = false

private fun Intent.appLink(): AppRoute? = if (action == Intent.ACTION_VIEW) dataString?.let(AppLink::parse) else null
