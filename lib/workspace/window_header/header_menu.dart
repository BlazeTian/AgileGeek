import 'package:flutter/widgets.dart';

import '../../l10n/l10n.dart';

/// The header's menus (see window_header.dart): what this app can do, not
/// the whole of an editor's bar — File, Edit and View. About is a label of
/// its own beside them, which opens a dialog rather than a menu.
enum HeaderMenu {
  file('File'),
  edit('Edit'),
  view('View');

  const HeaderMenu(this.label);

  /// In English; see [localizedLabel].
  final String label;

  String localizedLabel(AppLocalizations l10n) => switch (this) {
    file => l10n.menuFile,
    edit => l10n.menuEdit,
    view => l10n.menuView,
  };
}

/// An entry of one of them: a rule between groups of commands, or a command.
class HeaderMenuItem {
  const HeaderMenuItem(
    this.label, {
    required this.onSelected,
    this.shortcut,
    this.checked = false,
    this.leading,
  }) : rule = false;

  /// A line between groups.
  const HeaderMenuItem.rule()
    : label = '',
      onSelected = null,
      shortcut = null,
      checked = false,
      leading = null,
      rule = true;

  final String label;

  /// Run when it is picked; null for a rule.
  final VoidCallback? onSelected;

  /// Its shortcut, shown at the right as the platform writes one (`Ctrl+Z`);
  /// null when it has none.
  final String? shortcut;

  /// Shown with a tick: one that is on (the sidebar, the window pinned).
  final bool checked;

  /// Drawn where the tick is, in the item's color, when it has none (a
  /// project's own icon).
  final Widget Function(Color color)? leading;

  final bool rule;
}
