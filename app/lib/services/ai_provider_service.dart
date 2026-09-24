import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Supported AI providers. Chat requests themselves are made directly from
/// the web layer (see `web/public/ai.js`) — this service only ever handles
/// the credential, which is why it stays native: a key must never live in
/// the WebView's JS context longer than one bridge round trip.
enum AiProvider { openai, anthropic, gemini }

extension AiProviderX on AiProvider {
  String get label => switch (this) {
    AiProvider.openai => 'OpenAI',
    AiProvider.anthropic => 'Claude',
    AiProvider.gemini => 'Gemini',
  };

  static AiProvider? fromId(String id) => switch (id) {
    'openai' => AiProvider.openai,
    'anthropic' => AiProvider.anthropic,
    'gemini' => AiProvider.gemini,
    _ => null,
  };
}

/// Stores API keys on-device (Keystore on Android, Keychain on iOS/macOS).
/// Keys never touch a server — they're read here only to answer a bridge
/// request from the web layer, which sends them straight to the provider's
/// own HTTPS API.
class AiProviderService {
  AiProviderService._();

  static const _storage = FlutterSecureStorage();

  static String _storageKey(AiProvider provider) => 'api_key_${provider.name}';

  // A platform with no secure-storage backend registered (e.g. the plain
  // widget-test harness) can leave the method channel call pending forever
  // instead of failing fast, so every call here is time-boxed.
  static const _storageTimeout = Duration(seconds: 3);

  static Future<void> saveApiKey(AiProvider provider, String key) async {
    final trimmed = key.trim();
    try {
      if (trimmed.isEmpty) {
        await _storage.delete(key: _storageKey(provider)).timeout(_storageTimeout);
        return;
      }
      await _storage
          .write(key: _storageKey(provider), value: trimmed)
          .timeout(_storageTimeout);
    } catch (_) {
      // No secure-storage backend available — the key simply won't persist
      // rather than hanging or crashing the app.
    }
  }

  static Future<String?> getApiKey(AiProvider provider) async {
    try {
      return await _storage.read(key: _storageKey(provider)).timeout(_storageTimeout);
    } catch (_) {
      return null;
    }
  }

  static Future<bool> hasApiKey(AiProvider provider) async {
    final key = await getApiKey(provider);
    return key != null && key.isNotEmpty;
  }
}
