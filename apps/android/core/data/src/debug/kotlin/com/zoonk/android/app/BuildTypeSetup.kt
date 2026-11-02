package com.zoonk.android.app

import android.util.Log
import com.zoonk.android.data.RequestLog
import okhttp3.Dns
import okhttp3.OkHttpClient
import java.net.InetAddress

// The emulator reaches the Mac at 10.0.2.2, and the local proxy routes by host name, so
// `*.localhost` names resolve there and keep their name.
internal fun OkHttpClient.Builder.buildTypeSetup(): OkHttpClient.Builder =
    dns(EmulatorHost).addInterceptor(RequestLog { Log.i("ZoonkHttp", it) })

private object EmulatorHost : Dns {
    override fun lookup(hostname: String): List<InetAddress> =
        if (hostname == "localhost" || hostname.endsWith(".localhost")) {
            listOf(InetAddress.getByName("10.0.2.2"))
        } else {
            Dns.SYSTEM.lookup(hostname)
        }
}
