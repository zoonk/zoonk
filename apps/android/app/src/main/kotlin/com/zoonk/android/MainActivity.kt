package com.zoonk.android

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.zoonk.android.app.ZoonkApp
import com.zoonk.android.app.ZoonkApplication
import com.zoonk.android.navigation.AppLink
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.theme.ZoonkTheme

class MainActivity : ComponentActivity() {
    private var pendingLink by mutableStateOf<AppRoute?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // A recreated activity already opened its link; its saved stacks show it.
        if (savedInstanceState == null) {
            pendingLink = intent.appLink()
        }

        val container = (application as ZoonkApplication).container

        setContent {
            ZoonkTheme {
                ZoonkApp(app = container, link = pendingLink, onLinkOpened = { pendingLink = null })
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.appLink()?.let { pendingLink = it }
    }
}

private fun Intent.appLink(): AppRoute? = if (action == Intent.ACTION_VIEW) dataString?.let(AppLink::parse) else null
