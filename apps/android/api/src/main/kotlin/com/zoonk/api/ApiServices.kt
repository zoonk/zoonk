package com.zoonk.api

import com.zoonk.api.apis.AccountApi
import com.zoonk.api.apis.ChaptersApi
import com.zoonk.api.apis.ContentGenerationApi
import com.zoonk.api.apis.CoursesApi
import com.zoonk.api.apis.ExamsApi
import com.zoonk.api.apis.FeedbackApi
import com.zoonk.api.apis.FilesApi
import com.zoonk.api.apis.GoalsApi
import com.zoonk.api.apis.HealthApi
import com.zoonk.api.apis.LanguageApi
import com.zoonk.api.apis.LearnerApi
import com.zoonk.api.apis.LessonsApi
import com.zoonk.api.apis.LibraryCoursesApi
import com.zoonk.api.apis.LibraryLessonsApi
import com.zoonk.api.apis.MemoryApi
import com.zoonk.api.apis.MilestonesApi
import com.zoonk.api.apis.MistakesApi
import com.zoonk.api.apis.OnboardingApi
import com.zoonk.api.apis.PlansApi
import com.zoonk.api.apis.ProgressApi
import com.zoonk.api.apis.SessionsApi
import com.zoonk.api.apis.SourcesApi
import com.zoonk.api.apis.StudySessionsApi
import com.zoonk.api.apis.SubscriptionsApi
import com.zoonk.api.apis.UsersApi
import com.zoonk.api.apis.WorkflowsApi
import com.zoonk.api.models.Goal
import com.zoonk.api.models.OpenedStudyDay
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.serializer
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.ResponseBody
import retrofit2.Converter
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.create
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path
import java.lang.reflect.Type
import java.util.UUID

/** [baseUrl] is the API's versioned root, ending in `/v1/`. */
class ApiServices(
    baseUrl: HttpUrl,
    client: OkHttpClient,
) {
    private val retrofit =
        Retrofit
            .Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(NullBody)
            .addConverterFactory(SerialNames)
            .addConverterFactory(FormFields)
            .addConverterFactory(ApiJson.asConverterFactory("application/json".toMediaType()))
            .build()

    val account: AccountApi by lazy { retrofit.create() }
    val chapters: ChaptersApi by lazy { retrofit.create() }
    val contentGeneration: ContentGenerationApi by lazy { retrofit.create() }
    val courses: CoursesApi by lazy { retrofit.create() }
    val exams: ExamsApi by lazy { retrofit.create() }
    val feedback: FeedbackApi by lazy { retrofit.create() }
    val files: FilesApi by lazy { retrofit.create() }
    val goals: GoalsApi by lazy { retrofit.create() }
    val health: HealthApi by lazy { retrofit.create() }
    val language: LanguageApi by lazy { retrofit.create() }
    val learner: LearnerApi by lazy { retrofit.create() }
    val lessons: LessonsApi by lazy { retrofit.create() }
    val libraryCourses: LibraryCoursesApi by lazy { retrofit.create() }
    val libraryLessons: LibraryLessonsApi by lazy { retrofit.create() }
    val memory: MemoryApi by lazy { retrofit.create() }
    val milestones: MilestonesApi by lazy { retrofit.create() }
    val mistakes: MistakesApi by lazy { retrofit.create() }
    val onboarding: OnboardingApi by lazy { retrofit.create() }
    val plans: PlansApi by lazy { retrofit.create() }
    val progress: ProgressApi by lazy { retrofit.create() }
    val sessions: SessionsApi by lazy { retrofit.create() }
    val sources: SourcesApi by lazy { retrofit.create() }
    val studySessions: StudySessionsApi by lazy { retrofit.create() }
    val subscriptions: SubscriptionsApi by lazy { retrofit.create() }
    val users: UsersApi by lazy { retrofit.create() }
    val workflows: WorkflowsApi by lazy { retrofit.create() }
    val jsonBodies: JsonBodyApi by lazy { retrofit.create() }
}

/**
 * Operations whose request must send explicit `null`s, which [ApiJson] leaves out of generated
 * bodies: each takes its body as JSON built by the caller.
 */
interface JsonBodyApi {
    /** The generated `openStudyDay`, whose shown block (`target`) keeps its `null` fields. */
    @POST("goals/{goalId}/study-sessions")
    suspend fun openStudyDay(
        @Path("goalId") goalId: UUID,
        @Body body: JsonObject,
    ): Response<OpenedStudyDay>

    /** The generated `startCourseGoal`, whose `level` is `null` for a quick test and absent to ask it in the setup. */
    @POST("courses/{courseId}/goals")
    suspend fun startCourseGoal(
        @Path("courseId") courseId: UUID,
        @Body body: JsonObject,
    ): Response<Goal>
}

/**
 * Some operations answer `null` while there's nothing yet (a conversation before its first
 * question), which the generated client's non-null models can't decode.
 */
private object NullBody : Converter.Factory() {
    override fun responseBodyConverter(
        type: Type,
        annotations: Array<out Annotation>,
        retrofit: Retrofit,
    ): Converter<ResponseBody, *> {
        val next = retrofit.nextResponseBodyConverter<Any>(this, type, annotations)
        return Converter<ResponseBody, Any?> { body ->
            val peek = body.source().peek()
            if (peek.request(NULL.length.toLong()) && peek.readUtf8(NULL.length.toLong()) == NULL && peek.exhausted()) {
                body.close()
                null
            } else {
                next.convert(body)
            }
        }
    }

    private const val NULL = "null"
}

/** The generated enums don't override `toString`, which Retrofit sends for a query or path; their `@SerialName` is the contract's name. */
private object SerialNames : Converter.Factory() {
    override fun stringConverter(
        type: Type,
        annotations: Array<out Annotation>,
        retrofit: Retrofit,
    ): Converter<*, String>? {
        if ((type as? Class<*>)?.isEnum != true) return null
        val serializer = ApiJson.serializersModule.serializer(type)
        return Converter<Any, String> { value -> ApiJson.encodeToJsonElement(serializer, value).jsonPrimitive.content }
    }
}
