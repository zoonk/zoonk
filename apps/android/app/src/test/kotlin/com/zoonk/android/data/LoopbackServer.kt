package com.zoonk.android.data

import mockwebserver3.MockWebServer
import java.net.InetAddress

/**
 * Starts on 127.0.0.1 and names it in the server's urls. MockWebServer's own urls say "localhost",
 * which OkHttp tries on ::1 first, where another process on the machine can hold the same port.
 */
internal fun MockWebServer.startOnLoopback() = start(InetAddress.getByAddress("127.0.0.1", byteArrayOf(127, 0, 0, 1)), 0)
