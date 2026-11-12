import 'package:flutter/material.dart';

import '../../l10n/l10n.dart';
import '../../theme/workbench_theme.dart' show themeColors;
import 'about_dialog.dart' show showAboutAgileGeek;

/// The header's About: a label that opens the About dialog.
class AboutPopoverButton extends StatefulWidget {
  const AboutPopoverButton({super.key, this.onOpenSettings});

  /// Kept for callers that passed it; the dialog needs nothing.
  final void Function(Object? section)? onOpenSettings;

  @override
  State<AboutPopoverButton> createState() => _AboutPopoverButtonState();
}

class _AboutPopoverButtonState extends State<AboutPopoverButton> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final colors = themeColors;
    final label = context.l10n.menuAboutAgileGeek;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      onTap: () => showAboutAgileGeek(context),
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        onEnter: (_) => setState(() => _hover = true),
        onExit: (_) => setState(() => _hover = false),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => showAboutAgileGeek(context),
          child: Container(
            height: 22,
            padding: const EdgeInsets.symmetric(horizontal: 9),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: _hover
                  ? colors['menubar.selectionBackground']
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(5),
            ),
            child: Text(
              label,
              style: TextStyle(
                color: _hover
                    ? colors['menubar.selectionForeground']
                    : colors['titleBar.activeForeground'],
                fontSize: 12.5,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
