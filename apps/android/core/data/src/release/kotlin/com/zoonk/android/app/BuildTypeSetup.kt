package com.zoonk.android.app

import io.sentry.okhttp.SentryOkHttpEventListener
import io.sentry.okhttp.SentryOkHttpInterceptor
import okhttp3.OkHttpClient

// The API reports its own failures, so failed requests make no Sentry events.
internal fun OkHttpClient.Builder.buildTypeSetup(): OkHttpClient.Builder =
    addInterceptor(SentryOkHttpInterceptor(captureFailedRequests = false)).eventListener(SentryOkHttpEventListener())
