// The app's own update path against the live server: the manifest it serves
// is read by the app's parser, its links pass the app's policy, and its
// signature verifies against the key baked into this build.
//
// Skipped unless AGILEGEEK_LIVE_UPDATE_TEST=1: it talks to a real server.

import 'dart:convert';
import 'dart:io';

import 'package:agilegeek/update/update_manifest.dart';
import 'package:agilegeek/update/update_signature.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final on = Platform.environment['AGILEGEEK_LIVE_UPDATE_TEST'] == '1';

  test('the live manifest parses, links are allowed, signatures verify', () async {
    if (!on) {
      markTestSkipped('AGILEGEEK_LIVE_UPDATE_TEST not set');
      return;
    }
    // The test binding answers every request 400 to keep suites off the
    // network; this one is a real connection on purpose.
    HttpOverrides.global = _RealHttp();

    final client = HttpClient();
    try {
      final request = await client
          .getUrl(Uri.parse(defaultManifestUrl))
          .timeout(const Duration(seconds: 20));
      final response = await request.close().timeout(const Duration(seconds: 20));
      expect(response.statusCode, 200, reason: 'GET $defaultManifestUrl');
      final bytes = await response.fold<List<int>>(
        <int>[], (all, chunk) => all..addAll(chunk));
      final text = utf8.decode(bytes);

      final manifest = UpdateManifest.parse(text);
      expect(manifest.platforms, isNotEmpty);

      for (final platform in manifest.platforms) {
        final asset = manifest.assetFor(platform)!;
        expect(
          UpdateSignature.verify(
            payload: UpdateSignature.payload(
              version: '${manifest.version}',
              platform: platform,
              size: asset.size,
              sha256: asset.sha256,
            ),
            signature: asset.signature,
          ),
          isTrue,
          reason: '$platform: signed by the release tool, verified here',
        );
        expect(
          asset.url.toString(),
          startsWith(agileGeekServerForTest),
          reason: '$platform: served from this build\'s server',
        );
      }

      // The download itself answers, with the size the manifest names.
      final head = await client
          .headUrl(manifest.assetFor(manifest.platforms.first)!.url)
          .timeout(const Duration(seconds: 20));
      final downloaded = await head.close().timeout(const Duration(seconds: 20));
      expect(downloaded.statusCode, 200);
      expect(
        downloaded.contentLength,
        manifest.assetFor(manifest.platforms.first)!.size,
      );
    } finally {
      client.close(force: true);
    }
  }, timeout: const Timeout(Duration(minutes: 3)));
}

class _RealHttp extends HttpOverrides {}

/// The server this build talks to (baked in at compile time).
const agileGeekServerForTest = 'http://43.142.179.88:8080';
