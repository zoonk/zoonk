package com.zoonk.android.app

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri
import com.zoonk.android.R

private val OPENABLE_SCHEMES = setOf("http", "https", "mailto")

/**
 * Lesson text and sources come from AI and research, so a link in them can name any scheme: only web
 * pages and email open, never a call, a message or another app.
 */
internal fun mayOpenLink(url: String): Boolean = url.substringBefore(':', "").lowercase() in OPENABLE_SCHEMES

/** Opens a web page in a Custom Tab and an email address in its own app; false when nothing on the phone opens it. */
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
 * Opens a link it may open, or says nothing on the phone can: a toast, the platform's own answer to
 * that, shows over any sheet or dialog the link sits in.
 */
fun openWebPage(
    context: Context,
    url: String,
) {
    if (mayOpenLink(url) && !launchWebPage(context, url)) Toast.makeText(context, R.string.web_page_unavailable, Toast.LENGTH_LONG).show()
}
