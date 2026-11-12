import 'dart:async';

import 'package:flutter/material.dart';

import '../../chat/floating/floating_placement.dart';
import '../../chat/floating/hover_tooltip.dart';
import '../../chat/widgets/hover_builder.dart';
import '../../ide/ide_menu.dart';
import '../../l10n/l10n.dart';
import '../../settings/app_locale.dart';
import '../../settings/pages/language_page.dart' show LanguageSettingsPage;
import '../../theme/codicons.dart';
import '../../theme/workbench_theme.dart' show themeColors;

/// The display language, in the header: the language in use, as its own
/// name, opening a menu of the ones the app is translated into. Picking one
/// applies it at once, as the settings page's dropdown does.
class LanguagePickerButton extends StatelessWidget {
  const LanguagePickerButton({
    super.key,
    required this.locale,
    this.compact = false,
  });

  final AppLocale locale;

  /// In a narrow header: the language's code alone (`ZH`, `EN`), so the
  /// strip fits the tools beside it.
  final bool compact;

  /// Each language in its own language, as the settings page names them.
  static const names = LanguageSettingsPage.nativeNames;

  /// The language in effect, as it shows on the button: the system's when
  /// the setting follows it.
  static String labelOf(BuildContext context, AppLocale locale) {
    final setting = locale.setting;
    if (setting != null) return names[setting] ?? setting;
    final system = AppLocale.systemLocale(
      View.maybeOf(context)?.platformDispatcher.locales,
    );
    final normalized = AppLocale.normalize(system.toLanguageTag());
    return names[normalized] ?? names.values.first;
  }

  /// The language's short code, for a narrow header: `ZH` or `EN`.
  String _codeOf(AppLocale locale) {
    final setting = locale.setting;
    return setting == AppLocale.simplifiedChinese ? 'ZH' : 'EN';
  }

  void _open(BuildContext context) {
    final box = context.findRenderObject()! as RenderBox;
    final setting = locale.setting;
    final system = AppLocale.systemLocale(
      View.maybeOf(context)?.platformDispatcher.locales,
    );
    final systemSetting = AppLocale.normalize(system.toLanguageTag());
    final l10n = context.l10n;
    unawaited(
      showIdeMenu(
        context,
        anchor: box.localToGlobal(Offset.zero) & box.size,
        entries: [
          IdeMenuAction(
            l10n.languageSettingsFollowSystemCurrent(
              names[systemSetting] ?? names.values.first,
            ),
            checked: setting == null,
            onSelected: () => locale.select(null),
          ),
          const IdeMenuSeparator(),
          for (final option in AppLocale.settings)
            IdeMenuAction(
              names[option]!,
              checked: setting == option,
              onSelected: () => locale.select(option),
            ),
        ],
      ),
    );
  }

  /// The width below which the full name would crowd the strip: the code
  /// stands in for it.
  static const _compactBelow = 240.0;

  /// The width the full name needs beside the other tools.
  static const _fullWidth = 92.0;

  @override
  Widget build(BuildContext context) {
    // The button names the language in use, so it rebuilds when it changes.
    return ListenableBuilder(
      listenable: locale,
      builder: (context, _) => _build(context),
    );
  }

  Widget _build(BuildContext context) {
    final l10n = context.l10n;
    final colors = themeColors;
    final label = labelOf(context, locale);
    // A narrow strip gets the code; the full name needs the room.
    final short = compact || (MediaQuery.sizeOf(context).width < 1100);
    final shown = short ? _codeOf(locale) : label;
    final tooltip = l10n.languageSettingsDisplayLanguageLabel(label);
    return HoverTooltip(
      placement: (side: FloatingSide.bottom, align: FloatingAlign.end),
      content: (_) => Text(tooltip),
      child: Semantics(
        button: true,
        label: tooltip,
        excludeSemantics: true,
        child: HoverBuilder(
          cursor: SystemMouseCursors.click,
          builder: (context, hovered) => GestureDetector(
            onTap: () => _open(context),
            child: Container(
              height: 22,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              decoration: BoxDecoration(
                color: hovered
                    ? colors['toolbar.hoverBackground']
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(5),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    shown,
                    style: TextStyle(
                      color: hovered
                          ? colors['menubar.selectionForeground']
                          : colors['titleBar.activeForeground'],
                      fontSize: 12.5,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    Codicons.chevronDown,
                    size: 11,
                    color: colors['titleBar.activeForeground'],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
