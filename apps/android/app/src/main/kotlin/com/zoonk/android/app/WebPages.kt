package com.zoonk.android.app

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri
import com.zoonk.android.R

/** Opens a web page in a Custom Tab and any other link in its own app; false when nothing on the phone opens it. */
private fun launchWebPage(
    context: Context,
    url: String,
): Boolean {
    val uri = url.toUri()

    return try {
        if (uri.scheme == "http" || uri.scheme == "https") {
            CustomTabsIntent.Builder().build().launchUrl(context, uri)
        } else {
            context.startActivity(Intent(Intent.ACTION_VIEW, uri))
        }
        true
    } catch (_: ActivityNotFoundException) {
        false
    }
}

/**
 * Opens a link, or says nothing on the phone can: a toast, the platform's own answer to that, shows
 * over any sheet or dialog the link sits in.
 */
fun openWebPage(
    context: Context,
    url: String,
) {
    if (!launchWebPage(context, url)) Toast.makeText(context, R.string.web_page_unavailable, Toast.LENGTH_LONG).show()
}
