package com.zoonk.android.data

import com.zoonk.api.models.MeResponse

class LiveSessionApi(
    private val api: ApiClients,
) : SessionApi {
    override suspend fun currentUser(token: String): MeResponse = perform { api.bearer(token).account.getCurrentUser() }

    override suspend fun revoke(token: String) = perform { api.bearer(token).sessions.deleteCurrentSession() }
}
