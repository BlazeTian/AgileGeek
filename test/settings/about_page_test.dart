import 'package:agilegeek/l10n/app_localizations.dart';
import 'package:agilegeek/settings/pages/about_page.dart';
import 'package:agilegeek/update/version.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Future<void> show(WidgetTester tester, Locale locale) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: locale,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: const Scaffold(body: AboutSettingsPage()),
      ),
    );
    await tester.pump();
  }

  testWidgets('says what AgileGeek is, which build, and where it is made', (
    tester,
  ) async {
    await show(tester, const Locale('zh'));
    expect(find.text('关于'), findsOneWidget);
    expect(find.text('AgileGeek'), findsOneWidget);
    expect(
      find.text(
        '版本 ${currentAppVersion.marketing}（${currentAppVersion.build}）',
      ),
      findsOneWidget,
    );
    expect(
      find.text('github.com/agilegeek-dev/agilegeek · 免费开源，GPL-3.0 许可证'),
      findsOneWidget,
    );
    expect(find.text('去 GitHub 点 Star'), findsOneWidget);
    expect(find.text('agilegeek.dev'), findsOneWidget);
    expect(find.text('更新日志'), findsOneWidget);
    expect(find.text('反馈问题'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('its links', () {
    expect(
      AboutSettingsPage.issues,
      Uri.parse('https://github.com/agilegeek-dev/agilegeek/issues'),
    );
  });
}
