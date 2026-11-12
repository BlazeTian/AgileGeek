import 'dart:async';

import 'package:flutter/material.dart';

import '../../chat/floating/floating_placement.dart';
import '../../chat/floating/hover_tooltip.dart';
import '../../chat/widgets/hover_builder.dart';
import '../../ide/ide_menu.dart';
import '../../l10n/l10n.dart';
import '../../settings/app_locale.dart';
import '../../settings/pages/language_page.dart' show LanguageSettingsPage;
import '../../theme/app_theme.dart';
import '../../theme/codicons.dart';
import '../../theme/workbench_theme.dart' show themeColors;

/// The display language, in the header: a globe that opens the ones the app
/// is translated into, each named in its own language. Picking one applies
/// it at once, as the settings page's dropdown does.
class LanguagePickerButton extends StatelessWidget {
  const LanguagePickerButton({super.key, required this.locale, this.size = 14});

  final AppLocale locale;

  /// The globe's size, as the pin's icon.
  final double size;

  /// Each language in its own language, as the settings page names them.
  static const names = LanguageSettingsPage.nativeNames;

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

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = themeColors;
    final name = names[locale.setting] ?? names.values.first;
    final tooltip = l10n.languageSettingsDisplayLanguageLabel(name);
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
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: hovered
                    ? colors['toolbar.hoverBackground']
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(5),
              ),
              child: Icon(
                Codicons.globe,
                size: size,
                color: hovered ? AppColors.text : AppColors.textMuted,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
