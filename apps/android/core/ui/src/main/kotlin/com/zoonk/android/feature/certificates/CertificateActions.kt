package com.zoonk.android.feature.certificates

import android.app.Activity
import android.content.ClipData
import android.content.ContentValues
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.RequiresApi
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.Clipboard
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import androidx.print.PrintHelper
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiException
import com.zoonk.api.models.OwnedCertificate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileNotFoundException
import java.io.IOException

enum class CertificateAction { Share, Print, Download }

/**
 * Share, print, download and copy. Each picture is fetched first, so [busy] names the action under
 * way; a download outlives the screen and reports through the app's snackbars.
 */
@Stable
class CertificateActions internal constructor(
    private val app: AppContainer,
    private val context: Context,
    private val scope: CoroutineScope,
    private val clipboard: Clipboard,
    private val pendingSave: MutableState<List<String>?>,
    private val saveAs: (String) -> Unit,
) {
    var busy by mutableStateOf<CertificateAction?>(null)
        private set

    /** The share sheet with the post picture, [caption] and the link, as main's Web Share sends them. */
    fun share(
        certificate: OwnedCertificate,
        fileName: String,
        caption: String,
    ) = run(CertificateAction.Share) {
        val uri = shared(app.certificateFiles.file(certificate.imageUrls.post.toString(), fileName))
        val send =
            Intent(Intent.ACTION_SEND).apply {
                type = PNG
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_TEXT, "$caption\n${certificate.url}")
                clipData = ClipData.newRawUri(fileName, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
        context.startActivity(Intent.createChooser(send, null))
    }

    /** The system's print screen, which also saves a PDF, landscape on whatever paper the printer has. */
    fun print(
        certificate: OwnedCertificate,
        fileName: String,
    ) = run(CertificateAction.Print) {
        val file = app.certificateFiles.file(certificate.imageUrls.print.toString(), fileName)
        PrintHelper(context.activity())
            .apply {
                scaleMode = PrintHelper.SCALE_MODE_FIT
                orientation = PrintHelper.ORIENTATION_LANDSCAPE
            }.printBitmap(fileName.removeSuffix(".png"), Uri.fromFile(file))
    }

    /** Into Pictures, where the gallery shows it; before Android 10 the learner picks the folder. */
    fun download(
        certificate: OwnedCertificate,
        fileName: String,
    ) {
        if (busy != null) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            pendingSave.value = listOf(certificate.imageUrls.print.toString(), fileName)
            saveAs(fileName)
            return
        }
        run(CertificateAction.Download) {
            savePicture(app.certificateFiles.file(certificate.imageUrls.print.toString(), fileName), fileName)
            app.snackbars.show(R.string.certificates_downloaded)
        }
    }

    fun copy(text: String) {
        scope.launch {
            clipboard.setClipEntry(ClipEntry(ClipData.newPlainText(text, text)))
            // Android 13 confirms a copy on its own.
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) app.snackbars.show(R.string.certificates_copied)
        }
    }

    /** Where the learner chose to save it, before Android 10; it survives the app being stopped meanwhile. */
    internal fun saved(target: Uri?) {
        val (url, fileName) = pendingSave.value ?: return
        pendingSave.value = null
        target ?: return
        run(CertificateAction.Download) {
            val file = app.certificateFiles.file(url, fileName)
            withContext(Dispatchers.IO) { copyInto(file, target) }
            app.snackbars.show(R.string.certificates_downloaded)
        }
    }

    private fun run(
        action: CertificateAction,
        work: suspend () -> Unit,
    ) {
        if (busy != null) return
        busy = action
        // A download outlives the screen; sharing and printing only matter while it shows.
        (if (action == CertificateAction.Download) app.scope else scope).launch {
            try {
                work()
            } catch (_: ApiException) {
                app.snackbars.show(R.string.certificates_picture_failed)
            } catch (_: IOException) {
                app.snackbars.show(R.string.certificates_picture_failed)
            } finally {
                busy = null
            }
        }
    }

    private fun shared(file: File): Uri = FileProvider.getUriForFile(context, context.packageName + CertificateFiles.AUTHORITY_SUFFIX, file)

    @RequiresApi(Build.VERSION_CODES.Q)
    private suspend fun savePicture(
        file: File,
        fileName: String,
    ) = withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        val details =
            ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
                put(MediaStore.Images.Media.MIME_TYPE, PNG)
                put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES)
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
        val item =
            resolver.insert(MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), details)
                ?: throw IOException("No picture to write")
        try {
            copyInto(file, item)
            resolver.update(item, ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }, null, null)
        } catch (e: IOException) {
            resolver.delete(item, null, null)
            throw e
        }
    }

    private fun copyInto(
        file: File,
        target: Uri,
    ) {
        val out = context.contentResolver.openOutputStream(target) ?: throw FileNotFoundException(target.toString())
        out.use { stream -> file.inputStream().use { it.copyTo(stream) } }
    }

    private companion object {
        const val PNG = "image/png"
    }
}

@Composable
fun rememberCertificateActions(app: AppContainer): CertificateActions {
    val context = LocalContext.current
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    val pendingSave = rememberSaveable { mutableStateOf<List<String>?>(null) }
    var actions: CertificateActions? = null
    val saveAs =
        rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("image/png")) { target -> actions?.saved(target) }
    return remember(app, context, clipboard, scope) {
        CertificateActions(app, context, scope, clipboard, pendingSave) { name -> saveAs.launch(name) }
    }.also { actions = it }
}

/** Printing opens its screen over an activity, which a dialog's context wraps. */
private tailrec fun Context.activity(): Context =
    when (this) {
        is Activity -> this
        is ContextWrapper -> baseContext.activity()
        else -> this
    }
