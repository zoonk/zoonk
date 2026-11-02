package com.zoonk.android.data

import com.zoonk.api.ApiJson
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement

/**
 * Reads a generated model as another type with the same JSON, such as the value type a shared
 * composable draws. The generator writes one class per place a schema is inlined (a block's
 * question, a checkpoint's, a mock's), so a value type decodes from that JSON once instead of
 * mapping every copy.
 */
inline fun <reified From, reified To> From.recode(): To = ApiJson.decodeFromJsonElement(ApiJson.encodeToJsonElement(this))
