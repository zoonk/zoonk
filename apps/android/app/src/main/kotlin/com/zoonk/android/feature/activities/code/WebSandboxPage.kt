package com.zoonk.android.feature.activities.code

import android.annotation.SuppressLint
import android.content.Context
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.net.toUri
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.io.ByteArrayInputStream

/**
 * `assets/sandbox/index.html`, generated from main's sandbox, in a WebView that's never shown. The page's
 * policy lets it run only its own script, start workers from `data:` URLs and load Pyodide and sql.js from
 * jsDelivr; requests to any other host fail here too.
 */
internal class WebSandboxPage private constructor(
    private val webView: WebView,
) : SandboxPage {
    private var replies: JavaScriptReplyProxy? = null

    @SuppressLint("RequiresFeature") // A reply proxy exists only once the listener, added after the feature check, got a message.
    override fun send(message: String) {
        replies?.postMessage(message)
    }

    override fun close() {
        webView.destroy()
    }

    companion object {
        private const val PAGE_HOST = WebViewAssetLoader.DEFAULT_DOMAIN
        private const val RUNTIME_HOST = "cdn.jsdelivr.net"
        private val pageOrigin = "https://$PAGE_HOST".toUri()

        /** Null when this device's WebView can't host it, like while the WebView app updates. */
        @SuppressLint("SetJavaScriptEnabled") // The page runs only its own script; learner code runs in its workers.
        fun open(
            context: Context,
            listener: SandboxPage.Listener,
        ): SandboxPage? {
            if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return null
            val webView = runCatching { WebView(context) }.getOrNull() ?: return null
            val page = WebSandboxPage(webView)
            val assets =
                WebViewAssetLoader
                    .Builder()
                    .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
                    .build()

            webView.settings.apply {
                javaScriptEnabled = true
                allowFileAccess = false
                allowContentAccess = false
            }

            webView.webViewClient =
                object : WebViewClient() {
                    override fun shouldInterceptRequest(
                        view: WebView,
                        request: WebResourceRequest,
                    ): WebResourceResponse? =
                        when (request.url.host) {
                            PAGE_HOST -> assets.shouldInterceptRequest(request.url) ?: forbidden()
                            RUNTIME_HOST -> null
                            else -> forbidden()
                        }

                    override fun shouldOverrideUrlLoading(
                        view: WebView,
                        request: WebResourceRequest,
                    ) = true

                    override fun onRenderProcessGone(
                        view: WebView,
                        detail: RenderProcessGoneDetail,
                    ): Boolean {
                        listener.onGone()
                        return true
                    }
                }

            WebViewCompat.addWebMessageListener(webView, "zoonkSandbox", setOf(pageOrigin.toString())) {
                _,
                message,
                sourceOrigin,
                isMainFrame,
                replyProxy,
                ->
                if (!isMainFrame || sourceOrigin != pageOrigin) return@addWebMessageListener
                page.replies = replyProxy
                message.data?.let(listener::onMessage)
            }

            webView.loadUrl("https://$PAGE_HOST/assets/sandbox/index.html")
            return page
        }

        private fun forbidden() =
            WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", emptyMap(), ByteArrayInputStream(ByteArray(0)))
    }
}
