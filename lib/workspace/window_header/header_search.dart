import 'package:flutter/material.dart';

import '../../chat/chat_keys.dart';
import '../../ide/ide_hover.dart';
import '../../keybindings/chat_keybindings.dart';
import '../../l10n/l10n.dart';
import '../../theme/codicons.dart';
import '../../theme/workbench_theme.dart' show themeColors;

/// The search, in the middle of the header: a box that opens the palette
/// (agents, what was said in them, files, commands), as the sidebar's row
/// did before it moved up here.
class HeaderSearch extends StatefulWidget {
  const HeaderSearch({super.key, required this.onTap});

  final VoidCallback onTap;

  /// How wide it is drawn: the strip's middle, held between these so it
  /// neither crowds the menus nor shrinks to nothing.
  static const minWidth = 180.0;
  static const maxWidth = 420.0;

  @override
  State<HeaderSearch> createState() => _HeaderSearchState();
}

class _HeaderSearchState extends State<HeaderSearch> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final colors = themeColors;
    final l10n = context.l10n;
    final foreground = colors[_hover
        ? 'commandCenter.activeForeground'
        : 'commandCenter.foreground'];
    return IdeHover(
      message: ChatKeys.titleWithKey(
        l10n.cmdChatSearch,
        ChatCommandIds.search,
        ChatKeys.chatLayout,
      ),
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        onEnter: (_) => setState(() => _hover = true),
        onExit: (_) => setState(() => _hover = false),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.onTap,
          child: Container(
            constraints: const BoxConstraints(
              maxWidth: HeaderSearch.maxWidth,
              minWidth: HeaderSearch.minWidth,
            ),
            height: 22,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            decoration: BoxDecoration(
              color: colors[_hover
                  ? 'commandCenter.activeBackground'
                  : 'commandCenter.background'],
              borderRadius: BorderRadius.circular(5),
              border: Border.all(
                color: colors[_hover
                    ? 'commandCenter.activeBorder'
                    : 'commandCenter.border'],
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Codicons.search, size: 14, color: foreground),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    l10n.sidebarSearch,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, color: foreground),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
