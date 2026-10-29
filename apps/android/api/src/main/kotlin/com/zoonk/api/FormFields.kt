package com.zoonk.api

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Converter
import retrofit2.Retrofit
import retrofit2.http.Part
import java.lang.reflect.Type
import java.util.UUID

/**
 * Retrofit sends a multipart field through the JSON converter, which quotes strings and UUIDs; the
 * API reads form fields as plain text.
 */
internal object FormFields : Converter.Factory() {
    private val plainText = "text/plain; charset=utf-8".toMediaType()
    private val scalars: Set<Type?> = setOf(String::class.java, UUID::class.java, Long::class.javaObjectType, Long::class.javaPrimitiveType)

    override fun requestBodyConverter(
        type: Type,
        parameterAnnotations: Array<out Annotation>,
        methodAnnotations: Array<out Annotation>,
        retrofit: Retrofit,
    ): Converter<*, RequestBody>? {
        if (type !in scalars || parameterAnnotations.none { it is Part }) return null
        return Converter<Any, RequestBody> { it.toString().toRequestBody(plainText) }
    }
}
