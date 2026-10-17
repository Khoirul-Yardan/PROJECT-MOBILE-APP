import 'package:ai_hub/services/assemblyai_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('auth/not-found statuses stop polling, transient ones keep retrying', () {
    for (final code in [400, 401, 403, 404]) {
      expect(AssemblyAiService.isFatalPollStatus(code), isTrue, reason: '$code');
    }
    for (final code in [200, 429, 500, 502, 503]) {
      expect(AssemblyAiService.isFatalPollStatus(code), isFalse, reason: '$code');
    }
  });
}
