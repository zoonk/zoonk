package com.zoonk.android.feature.onboarding

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.generationEvents
import com.zoonk.android.data.perform
import com.zoonk.android.data.withBearer
import com.zoonk.api.ApiJson
import com.zoonk.api.models.AllowanceResponse
import com.zoonk.api.models.CreateUploadRequest
import com.zoonk.api.models.Generation
import com.zoonk.api.models.Goal
import com.zoonk.api.models.GoalCreateInput
import com.zoonk.api.models.GoalCreateResponse
import com.zoonk.api.models.GoalUnderstandingInput
import com.zoonk.api.models.JoinInstrumentWaitlistRequest
import com.zoonk.api.models.MaterialQuestionAnswer
import com.zoonk.api.models.MaterialQuestionInput
import com.zoonk.api.models.OnboardingDraft
import com.zoonk.api.models.OnboardingDraftEdit
import com.zoonk.api.models.PlanLinkStartInput
import com.zoonk.api.models.Source
import com.zoonk.api.models.UploadToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okio.BufferedSink
import okio.source
import retrofit2.Response
import java.io.IOException
import java.io.InputStream
import java.util.Base64
import java.util.TimeZone
import java.util.UUID

/** A file the learner picked, read once when it's sent. */
class PickedFile(
    val name: String,
    val mimeType: String?,
    val size: Long?,
    val open: () -> InputStream,
)

interface OnboardingApi {
    suspend fun understand(
        session: AuthenticatedSession,
        goal: String,
        language: String,
    ): OnboardingDraft

    suspend fun draft(
        session: AuthenticatedSession,
        id: String,
    ): OnboardingDraft

    suspend fun readAgain(
        session: AuthenticatedSession,
        id: String,
    ): OnboardingDraft

    suspend fun revise(
        session: AuthenticatedSession,
        id: String,
        edit: OnboardingDraftEdit,
    ): OnboardingDraft

    suspend fun createGoals(
        session: AuthenticatedSession,
        input: GoalCreateInput,
    ): GoalCreateResponse

    suspend fun createFromPlanLink(
        session: AuthenticatedSession,
        planId: String,
        input: PlanLinkStartInput,
    ): Goal

    suspend fun joinWaitlist(
        session: AuthenticatedSession,
        instrument: String,
        language: String,
    )

    suspend fun allowance(session: AuthenticatedSession): AllowanceResponse

    /** Straight to Blob storage, which the API signs, since requests to the API are capped at 4.5 MB. */
    suspend fun uploadFile(
        session: AuthenticatedSession,
        pathname: String,
        file: PickedFile,
    )

    suspend fun attach(
        session: AuthenticatedSession,
        request: CreateUploadRequest,
    ): Source

    suspend fun askMaterial(
        session: AuthenticatedSession,
        input: MaterialQuestionInput,
    ): MaterialQuestionAnswer

    fun generationEvents(
        session: AuthenticatedSession,
        id: String,
    ): Flow<GenerationEvent>

    suspend fun generationStatus(
        session: AuthenticatedSession,
        id: String,
    ): Generation.Status
}

class LiveOnboardingApi(
    private val api: ApiClients,
) : OnboardingApi {
    override suspend fun understand(
        session: AuthenticatedSession,
        goal: String,
        language: String,
    ) = perform {
        api.clients(session).onboarding.createGoalUnderstanding(
            GoalUnderstandingInput(goal = goal, language = language, timeZone = TimeZone.getDefault().id),
        )
    }

    override suspend fun draft(
        session: AuthenticatedSession,
        id: String,
    ) = perform { api.clients(session).onboarding.getGoalUnderstanding(UUID.fromString(id)) }

    override suspend fun readAgain(
        session: AuthenticatedSession,
        id: String,
    ) = perform { api.clients(session).onboarding.createGoalUnderstandingGeneration(UUID.fromString(id)) }

    override suspend fun revise(
        session: AuthenticatedSession,
        id: String,
        edit: OnboardingDraftEdit,
    ) = perform { api.clients(session).onboarding.reviseGoalUnderstanding(UUID.fromString(id), edit) }

    override suspend fun createGoals(
        session: AuthenticatedSession,
        input: GoalCreateInput,
    ) = perform { api.clients(session).goals.createGoals(input) }

    override suspend fun createFromPlanLink(
        session: AuthenticatedSession,
        planId: String,
        input: PlanLinkStartInput,
    ) = perform { api.clients(session).plans.createGoalFromPlanLink(UUID.fromString(planId), input) }

    override suspend fun joinWaitlist(
        session: AuthenticatedSession,
        instrument: String,
        language: String,
    ) {
        perform { api.clients(session).onboarding.joinInstrumentWaitlist(JoinInstrumentWaitlistRequest(instrument, language)) }
    }

    override suspend fun allowance(session: AuthenticatedSession) = perform { api.clients(session).account.getCurrentUserAllowance() }

    override suspend fun uploadFile(
        session: AuthenticatedSession,
        pathname: String,
        file: PickedFile,
    ) {
        val signed = perform { uploadToken(session, pathname) }.presignedUrlPayload
        putBlob(pathname, file, signed.delegationToken, signed.signature, signed.params)
    }

    /** Vercel Blob's body needs `clientPayload` sent as null, which the generated client leaves out. */
    private suspend fun uploadToken(
        session: AuthenticatedSession,
        pathname: String,
    ): Response<UploadToken> {
        val body =
            buildJsonObject {
                putJsonObject("payload") {
                    put("clientPayload", JsonNull)
                    put("multipart", false)
                    put("pathname", pathname)
                }
                put("type", "blob.generate-presigned-url")
            }
        val request =
            Request
                .Builder()
                .url(api.baseUrl.resolve("uploads/tokens")!!)
                .post(body.toString().toRequestBody("application/json".toMediaType()))
                .build()
        return withContext(Dispatchers.IO) {
            val raw =
                api.http
                    .withBearer(session.bearerToken)
                    .newCall(request)
                    .execute()
            if (raw.isSuccessful) {
                raw.use { Response.success(ApiJson.decodeFromString<UploadToken>(it.body.string()), it) }
            } else {
                Response.error(raw.body, raw)
            }
        }
    }

    override suspend fun attach(
        session: AuthenticatedSession,
        request: CreateUploadRequest,
    ) = perform { api.clients(session).sources.createUpload(request) }.source

    override suspend fun askMaterial(
        session: AuthenticatedSession,
        input: MaterialQuestionInput,
    ) = perform { api.streamingClients(session).sources.askMaterialQuestion(input) }

    override fun generationEvents(
        session: AuthenticatedSession,
        id: String,
    ) = api.generationEvents(id, session)

    override suspend fun generationStatus(
        session: AuthenticatedSession,
        id: String,
    ) = perform { api.clients(session).workflows.getGeneration(id) }.status

    /**
     * The request `@vercel/blob`'s `uploadPresigned()` makes from a browser (API version 12), as
     * Apple's `BlobUpload` sends it, so the app holds no store credentials.
     */
    private suspend fun putBlob(
        pathname: String,
        file: PickedFile,
        delegationToken: String,
        signature: String,
        params: Map<String, String>,
    ) {
        val storeId = blobStoreId(delegationToken) ?: throw ApiException(ApiError.Unavailable)
        val url =
            BLOB_API
                .toHttpUrl()
                .newBuilder()
                .addQueryParameter("pathname", pathname)
                .apply { params.toSortedMap().forEach { (key, value) -> addQueryParameter(key, value) } }
                .addQueryParameter("vercel-blob-delegation", delegationToken)
                .addQueryParameter("vercel-blob-signature", signature)
                .build()
        val body =
            object : RequestBody() {
                override fun contentType() = file.mimeType?.toMediaTypeOrNull()

                override fun contentLength() = file.size ?: -1

                override fun writeTo(sink: BufferedSink) {
                    file.open().source().use(sink::writeAll)
                }
            }
        val request =
            Request
                .Builder()
                .url(url)
                .put(body)
                .header("x-api-version", BLOB_API_VERSION)
                .header("x-vercel-blob-store-id", storeId)
                .header("x-api-blob-request-id", "$storeId:${System.currentTimeMillis()}:${UUID.randomUUID()}")
                .header("x-api-blob-request-attempt", "0")
                .header("x-vercel-blob-access", "private")
                .apply { file.mimeType?.let { header("x-content-type", it) } }
                .build()
        withContext(Dispatchers.IO) {
            try {
                api.streamingHttp.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) throw ApiException(ApiError.Unavailable)
                }
            } catch (e: IOException) {
                throw ApiException(ApiError.Network)
            }
        }
    }

    private companion object {
        const val BLOB_API = "https://vercel.com/api/blob/"
        const val BLOB_API_VERSION = "12"
    }
}

@Serializable
private class DelegationPayload(
    val storeId: String,
)

/** A delegation token's first segment is base64url JSON naming the store. */
internal fun blobStoreId(delegationToken: String): String? =
    try {
        val segment = delegationToken.substringBefore('.')
        val json = Base64.getUrlDecoder().decode(segment.padEnd((segment.length + 3) / 4 * 4, '=')).decodeToString()
        ApiJson.decodeFromString<DelegationPayload>(json).storeId.removePrefix("store_")
    } catch (e: IllegalArgumentException) {
        null
    }
