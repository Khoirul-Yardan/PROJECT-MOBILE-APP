import 'package:supabase_flutter/supabase_flutter.dart';

/// AI Hub — native-side Supabase mirror.
///
/// In the hybrid architecture, auth/profiles/friends/chat/activity all live
/// in the web layer (see `web/public/db.js`), which owns the "real" signed
/// in session. This native client exists for one reason: the Bot BPJS
/// screen is 100% native (mic/wake-word/TTS) and still needs to write
/// `activity_log` rows attributed to the signed-in user. [restoreSession]
/// mirrors the web session into this client right after login/logout so
/// that logging keeps working without duplicating the auth UI natively.
///
/// Only the project URL and the **publishable (anon)** key live here. Both
/// are safe to ship inside the compiled app: every row is scoped to the
/// signed-in user via Row Level Security, so the anon key alone cannot read
/// or write another user's data. The **secret/service_role key must never**
/// be added to this file or anywhere in the Flutter client — it bypasses RLS
/// entirely and would let anyone who decompiles the app read every user's log.
class SupabaseService {
  SupabaseService._();

  static const String _url = 'https://zcydtoywdcfjmhofdwwq.supabase.co';
  static const String _publishableKey =
      'sb_publishable_p8YiCyAUSuawGmeYqHjETA_419maiMf';

  static bool _initialized = false;

  static SupabaseClient get client => Supabase.instance.client;

  static Future<void> init() async {
    await Supabase.initialize(url: _url, publishableKey: _publishableKey);
    _initialized = true;
  }

  /// Mirrors the web layer's session into this native client using its
  /// refresh token, so [logActivity] can attribute rows to the right user.
  static Future<void> restoreSession(String refreshToken) async {
    if (!_initialized) return;
    try {
      await client.auth.setSession(refreshToken);
    } catch (_) {
      // Best-effort — Bot BPJS logging simply no-ops until the next call.
    }
  }

  static Future<void> signOut() async {
    if (!_initialized) return;
    try {
      await client.auth.signOut();
    } catch (_) {
      // Best-effort.
    }
  }

  static String? get userId =>
      _initialized ? client.auth.currentUser?.id : null;

  /// Records one activity row. Never throws — a logging failure (offline,
  /// not initialized in a test harness, RLS misconfigured, etc.) must not
  /// interrupt the feature that triggered it.
  static Future<void> logActivity({
    required String category, // 'AI' | 'Agents' | 'Bots' | 'VPN' | 'System'
    required String title,
    String? subtitle,
    String badge = 'Info', // 'Success' | 'Info' | 'Error'
  }) async {
    if (!_initialized) return;
    final uid = userId;
    if (uid == null) return;
    try {
      await client.from('activity_log').insert({
        'user_id': uid,
        'category': category,
        'title': title,
        'subtitle': subtitle,
        'badge': badge,
      });
    } catch (_) {
      // Logging is best-effort; swallow network/RLS errors.
    }
  }
}
