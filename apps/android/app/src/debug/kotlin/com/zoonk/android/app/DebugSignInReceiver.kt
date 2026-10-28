package com.zoonk.android.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import kotlinx.coroutines.launch

/**
 * Signs a debug build in with a session token from the local API, for persona walks and tests:
 * `adb shell am broadcast -a com.zoonk.debug.SIGN_IN -n com.zoonk.debug/com.zoonk.android.app.DebugSignInReceiver --es token <token>`.
 */
class DebugSignInReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        val token = intent.getStringExtra("token") ?: return
        val container = (context.applicationContext as ZoonkApplication).container
        val pending = goAsync()
        container.scope.launch {
            val result = container.sessions.signIn { token }
            Log.i("ZoonkSession", "Debug sign-in: $result")
            pending.finish()
        }
    }
}
