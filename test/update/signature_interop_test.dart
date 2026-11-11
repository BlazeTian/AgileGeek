// The release tool's signatures (tools/server/make-release.js) verified by
// the app's own check (UpdateSignature.verify): the two must agree, or no
// build could ever update itself.

import 'dart:convert';
import 'dart:io';

import 'package:agilegeek/update/update_manifest.dart';
import 'package:agilegeek/update/update_signature.dart';
import 'package:crypto/crypto.dart' as crypto;
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('a manifest made by the release tool carries signatures the app '
      'accepts', () {
    final path = Platform.environment['AGILEGEEK_SIGNED_MANIFEST'];
    if (path == null || !File(path).existsSync()) {
      markTestSkipped('AGILEGEEK_SIGNED_MANIFEST not set');
      return;
    }

    final manifest = UpdateManifest.parse(File(path).readAsStringSync());
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
        reason: '$platform: the release tool signed what the app expects',
      );
    }
  });

  test('the payload matches the tool\'s byte for byte', () {
    // tools/server/make-release.js builds the same string.
    expect(
      utf8.decode(UpdateSignature.payload(
        version: '1.2.0',
        platform: 'windows-x64',
        size: 12345,
        sha256: 'AABB',
      )),
      'agilegeek-update-v1\n1.2.0\nwindows-x64\n12345\naabb\n',
    );
  });

  test('sha-256 of the published file is the one in the manifest', () {
    final zip = Platform.environment['AGILEGEEK_RELEASE_FILE'];
    final manifestPath = Platform.environment['AGILEGEEK_SIGNED_MANIFEST'];
    if (zip == null ||
        manifestPath == null ||
        !File(zip).existsSync() ||
        !File(manifestPath).existsSync()) {
      markTestSkipped('AGILEGEEK_RELEASE_FILE / SIGNED_MANIFEST not set');
      return;
    }
    final manifest = UpdateManifest.parse(File(manifestPath).readAsStringSync());
    final asset = manifest.assetFor('windows-x64')!;
    final digest = crypto.sha256.convert(File(zip).readAsBytesSync()).toString();
    expect(digest, asset.sha256);
    expect(File(zip).lengthSync(), asset.size);
  });
}
