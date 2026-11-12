import 'dart:async';
import 'dart:ffi' show Abi;

import 'package:flutter/material.dart';

import '../../chat/panels/interaction_panel.dart';
import '../../l10n/l10n.dart';
import '../../platform/app_services.dart';
import '../../theme/app_theme.dart';
import '../../theme/workbench_theme.dart' show themeColors;
import '../../platform/app_platform.dart';
import '../../update/version.dart';
import '../editor_launcher.dart' show openExternal;

/// The app's icon, as the Dock and the taskbar show it.
const aboutIconAsset = 'assets/branding/app_icon.png';

/// About: what the app is, which build this is, where it is made, and under
/// which license. Opened from the header's About label.
Future<void> showAboutAgileGeek(BuildContext context) => showDialog<void>(
  context: context,
  // Black, not the theme's: as the app's other dialogs dim the window.
  barrierColor: const Color(0x88000000),
  builder: (context) => const _AboutAgileGeekDialog(),
);

/// This build's platform, as the dialog names it.
String get _platformName {
  final arch = Abi.current().toString().split('_').last;
  final os = AppPlatform.isMacOS
      ? 'macOS'
      : AppPlatform.isWindows
      ? 'Windows'
      : AppPlatform.isLinux
      ? 'Linux'
      : 'Unknown';
  return '$os · $arch';
}

class _AboutAgileGeekDialog extends StatelessWidget {
  const _AboutAgileGeekDialog();

  void _open(String url) => unawaited(openExternal(url));

  @override
  Widget build(BuildContext context) {
    // As the app's dialogs: a widget's colors, bordered in high contrast.
    final colors = themeColors;
    final l10n = context.l10n;
    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      child: Container(
        width: 420,
        padding: const EdgeInsets.fromLTRB(24, 22, 24, 18),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: switch (colors.get('contrastBorder')) {
            final border? => Border.all(color: border),
            null => null,
          },
          boxShadow: [
            BoxShadow(
              color: colors['widget.shadow'],
              blurRadius: 32,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 图标、名称、版本
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Image.asset(
                  aboutIconAsset,
                  width: 52,
                  height: 52,
                  filterQuality: FilterQuality.high,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            'AgileGeek',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 19,
                              fontWeight: FontWeight.w600,
                              letterSpacing: -0.2,
                            ),
                          ),
                          const SizedBox(width: 9),
                          Text(
                            l10n.aboutNameChinese,
                            style: TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        currentAppVersion.marketing,
                        style: TextStyle(
                          color: AppColors.textFaint,
                          fontSize: 11.5,
                          fontFamily: AppFonts.mono,
                          fontFamilyFallback: AppFonts.monoFallbacks,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            // 一句话说明
            Text(
              l10n.aboutTagline,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
                height: 1.55,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              l10n.aboutDescription,
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                height: 1.6,
              ),
            ),
            const SizedBox(height: 18),
            Divider(height: 1, color: colors.get('menu.separatorBackground')),
            const SizedBox(height: 12),
            // 信息行
            _InfoRow(
              label: l10n.aboutBuildLabel,
              value: '$currentAppVersion',
              mono: true,
            ),
            _InfoRow(
              label: l10n.aboutPlatformLabel,
              value: _platformName,
            ),
            _InfoRow(
              label: l10n.aboutLicenseLabel,
              value: 'GPL-3.0-only',
            ),
            const SizedBox(height: 14),
            Divider(height: 1, color: colors.get('menu.separatorBackground')),
            const SizedBox(height: 12),
            // 链接
            Row(
              children: [
                _Link(
                  label: l10n.aboutProjectHome,
                  onTap: () => _open(agileGeekWebsite),
                ),
                const SizedBox(width: 16),
                _Link(
                  label: l10n.aboutReportIssue,
                  onTap: () => _open('$agileGeekWebsite/issues'),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Align(
              alignment: Alignment.centerRight,
              child: PanelButton(
                label: l10n.commonClose,
                primary: true,
                onTap: () => Navigator.of(context).pop(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A label and its value, the value in the code face when [mono].
class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value, this.mono = false});

  final String label;
  final String value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
          ),
          Expanded(
            child: SelectableText(
              value,
              style: TextStyle(
                color: AppColors.text,
                fontSize: 12,
                fontFamily: mono ? AppFonts.mono : null,
                fontFamilyFallback: mono ? AppFonts.monoFallbacks : null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A link in the dialog's footer.
class _Link extends StatefulWidget {
  const _Link({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  State<_Link> createState() => _LinkState();
}

class _LinkState extends State<_Link> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        child: Text(
          widget.label,
          style: TextStyle(
            color: AppColors.accent,
            fontSize: 12.5,
            decoration: _hover ? TextDecoration.underline : null,
            decorationColor: AppColors.accent,
          ),
        ),
      ),
    );
  }
}
