package com.aihub.ai_hub

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import id.laskarmedia.openvpn_flutter.OpenVPNFlutterPlugin
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var pendingPick: MethodChannel.Result? = null
    private val pickRequestCode = 4711
    private val maxBytes = 256 * 1024

    // Native file picker (Storage Access Framework) for small text files such
    // as .ovpn — <input type="file"> does nothing in the Android WebView
    // host, and Android has no MIME type for .ovpn, so the picker is opened
    // with */* (nothing greyed out).
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "aihub/file_picker")
            .setMethodCallHandler { call, result ->
                if (call.method != "pickTextFile") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                if (pendingPick != null) {
                    result.error("busy", "Pemilih file sedang terbuka.", null)
                    return@setMethodCallHandler
                }
                pendingPick = result
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                }
                startActivityForResult(intent, pickRequestCode)
            }
    }

    private fun displayName(uri: Uri): String =
        contentResolver.query(uri, null, null, null, null)?.use { c ->
            val i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (i >= 0 && c.moveToFirst()) c.getString(i) else null
        } ?: "file"

    // openvpn_flutter needs this hook to resume connecting once the user
    // grants Android's "Connection request" VpnService permission dialog —
    // without it, approving that system dialog does nothing and the tunnel
    // never starts. See VpnTunnelService's OpenVPN branch.
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == pickRequestCode) {
            val result = pendingPick
            pendingPick = null
            val uri = data?.data
            if (result == null) return
            if (resultCode != RESULT_OK || uri == null) {
                result.success(mapOf("ok" to false, "cancelled" to true))
                return
            }
            try {
                val bytes = contentResolver.openInputStream(uri)!!.use { it.readBytes() }
                if (bytes.size > maxBytes) {
                    result.success(mapOf("ok" to false, "message" to "File terlalu besar (maks 256 KB)."))
                } else {
                    result.success(mapOf("ok" to true, "name" to displayName(uri), "text" to String(bytes, Charsets.UTF_8)))
                }
            } catch (e: Exception) {
                result.success(mapOf("ok" to false, "message" to (e.message ?: "Gagal membaca file.")))
            }
            return
        }
        OpenVPNFlutterPlugin.connectWhileGranted(requestCode == 24 && resultCode == RESULT_OK)
        super.onActivityResult(requestCode, resultCode, data)
    }
}
