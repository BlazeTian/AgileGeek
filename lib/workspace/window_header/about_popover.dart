import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show KeyDownEvent, LogicalKeyboardKey;

import '../../chat/floating/floating_registry.dart';
import '../../l10n/l10n.dart';
import '../../settings/settings_dialog.dart' show SettingsSection;
import '../../theme/app_theme.dart';
import '../../theme/workbench_theme.dart' show themeColors;
import '../../update/version.dart';
import '../editor_launcher.dart' show openExternal;
import '../../platform/app_services.dart';
import 'about_dialog.dart' show aboutIconAsset;

/// The header's About: the app, its version, and where to find it — a
/// popover under the button, not the dialog Help keeps for the same facts.
///
/// [onOpenSettings] shows the settings, on [SettingsSection.about] where the
/// same page is kept with the rest.
class AboutPopoverButton extends StatefulWidget {
  const AboutPopoverButton({super.key, this.size = 22, this.onOpenSettings});

  final double size;
  final void Function(SettingsSection section)? onOpenSettings;

  @override
  State<AboutPopoverButton> createState() => _AboutPopoverButtonState();
}

class _AboutPopoverButtonState extends State<AboutPopoverButton> {
  final _anchor = GlobalKey(debugLabel: 'about button');
  final _layer = OverlayPortalController();
  bool _open = false;

  void _toggle() {
    if (_open) {
      _close();
      return;
    }
    setState(() => _open = true);
    _layer.show();
    FloatingRegistry.openPopover(this, _close, onKey: _handleKey);
  }

  void _close() {
    if (!_open) return;
    setState(() => _open = false);
    if (_layer.isShowing) _layer.hide();
  }

  KeyEventResult _handleKey(KeyEvent event) {
    if (event is KeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.escape) {
      _close();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  Rect? get _anchorRect {
    final box = _anchor.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.hasSize) return null;
    return box.localToGlobal(Offset.zero) & box.size;
  }

  void _openSettings(SettingsSection section) {
    _close();
    widget.onOpenSettings?.call(section);
  }

  @override
  Widget build(BuildContext context) {
    return OverlayPortal(
      controller: _layer,
      overlayChildBuilder: (context) {
        final anchor = _anchorRect;
        if (anchor == null) return const SizedBox.shrink();
        return _AboutPanel(
          anchor: anchor,
          onOpenSettings: widget.onOpenSettings == null ? null : _openSettings,
          onDismiss: _close,
        );
      },
      child: KeyedSubtree(
        key: _anchor,
        child: _Trigger(open: _open, size: widget.size, onTap: _toggle),
      ),
    );
  }
}

class _Trigger extends StatefulWidget {
  const _Trigger({required this.open, required this.size, required this.onTap});

  final bool open;
  final double size;
  final VoidCallback onTap;

  @override
  State<_Trigger> createState() => _TriggerState();
}

class _TriggerState extends State<_Trigger> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final colors = themeColors;
    return Semantics(
      button: true,
      label: context.l10n.menuAboutAgileGeek,
      excludeSemantics: true,
      onTap: widget.onTap,
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        onEnter: (_) => setState(() => _hover = true),
        onExit: (_) => setState(() => _hover = false),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: widget.open
                  ? colors['toolbar.activeBackground']
                  : _hover
                  ? colors['toolbar.hoverBackground']
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(5),
            ),
            child: Text(
              context.l10n.menuAboutAgileGeek,
              style: TextStyle(
                color: widget.open || _hover
                    ? AppColors.text
                    : AppColors.textMuted,
                fontSize: 12.5,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The panel itself, under the button's right edge.
class _AboutPanel extends StatelessWidget {
  const _AboutPanel({
    required this.anchor,
    required this.onDismiss,
    this.onOpenSettings,
  });

  final Rect anchor;
  final VoidCallback onDismiss;
  final void Function(SettingsSection section)? onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final colors = themeColors;
    final l10n = context.l10n;
    final overlay =
        Overlay.of(context).context.findRenderObject()! as RenderBox;
    const width = 268.0;
    final left = (anchor.right - width)
        .clamp(8.0, overlay.size.width - width - 8);
    final top = anchor.bottom + 6;

    return Positioned(
      left: left,
      top: top,
      child: TapRegion(
        onTapOutside: (_) => onDismiss(),
        child: Material(
          type: MaterialType.transparency,
          child: Container(
            width: width,
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(9),
              border: Border.all(color: colors.get('menu.border') ?? Colors.transparent),
              boxShadow: [
                BoxShadow(
                  color: colors['widget.shadow'],
                  blurRadius: 22,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Image.asset(
                      aboutIconAsset,
                      width: 34,
                      height: 34,
                      filterQuality: FilterQuality.high,
                    ),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'AgileGeek',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 1),
                          Text(
                            currentAppVersion.marketing,
                            style: TextStyle(
                              color: AppColors.textFaint,
                              fontSize: 11,
                              fontFamily: AppFonts.mono,
                              fontFamilyFallback: AppFonts.monoFallbacks,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  l10n.aboutDescription,
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11.5,
                    height: 1.5,
                  ),
                ),
                if (onOpenSettings != null) ...[
                  const SizedBox(height: 10),
                  _Action(
                    label: l10n.settingsSectionAbout,
                    onTap: () => onOpenSettings!(SettingsSection.about),
                  ),
                ],
                const SizedBox(height: 4),
                _Action(
                  label: l10n.aboutRepository('GitHub'),
                  onTap: () {
                    onDismiss();
                    unawaited(openExternal(agileGeekWebsite));
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Action extends StatefulWidget {
  const _Action({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  State<_Action> createState() => _ActionState();
}

class _ActionState extends State<_Action> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final colors = themeColors;
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(
            color: _hover ? colors['list.hoverBackground'] : Colors.transparent,
            borderRadius: BorderRadius.circular(5),
          ),
          child: Text(
            widget.label,
            style: TextStyle(color: AppColors.text, fontSize: 12.5),
          ),
        ),
      ),
    );
  }
}
