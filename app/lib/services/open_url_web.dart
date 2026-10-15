import 'package:web/web.dart' as web;

/// Opens [url] in a new browser tab (Flutter web / `flutter run -d chrome`).
void openUrlInNewTab(String url) {
  web.window.open(url, '_blank');
}
