import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

/// Flat ink-bordered button — the native mirror of web/public/style.css's
/// .btn-primary. No gradient, no glow shadow: a solid rectangle with a
/// crisp border reads clearly and doesn't compete with page content.
class GradientButton extends StatelessWidget {
  const GradientButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.arrow = false,
  });
  final String label;
  final VoidCallback onPressed;
  final bool arrow;
  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.ink,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(3),
      side: const BorderSide(color: AppColors.ink),
    ),
    child: InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(3),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 50),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.surface,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
              ),
              if (arrow) ...[
                const SizedBox(width: 10),
                const Icon(
                  Icons.arrow_forward_rounded,
                  size: 18,
                  color: AppColors.accentTint,
                ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}

/// A ledger entry: flat surface, hairline border, a solid left rule in
/// ink (or an accent color for emphasis) instead of a floating shadow.
class HubCard extends StatelessWidget {
  const HubCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.accentBar = AppColors.ink,
    this.fill,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color accentBar;
  final Color? fill;
  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(3),
    child: Container(
      decoration: BoxDecoration(
        color: fill ?? AppColors.surface,
        border: Border.all(color: AppColors.line),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 3, color: accentBar),
            Flexible(
              child: Material(
                color: Colors.transparent,
                child: Padding(padding: padding, child: child),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

/// A flat icon chip — surface-sunken square, hairline border, no
/// gradient glow. `emphasis: true` fills it with the accent tint for the
/// rare icon that should draw the eye first.
class IconTile extends StatelessWidget {
  const IconTile(
    this.icon, {
    super.key,
    this.color = AppColors.ink,
    this.solid = false,
    this.size = 40,
  });
  final IconData icon;
  final Color color;
  final bool solid;
  final double size;
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(3),
      color: solid ? color : AppColors.surfaceSunken,
      border: solid ? null : Border.all(color: AppColors.line),
    ),
    child: Icon(
      icon,
      color: solid ? AppColors.surface : color,
      size: size * .52,
    ),
  );
}

/// Filter tabs matching web's .tabs/.chip — monospace label, filled ink
/// when active instead of a gradient pill.
class FilterTabs extends StatelessWidget {
  const FilterTabs({
    super.key,
    required this.labels,
    required this.selected,
    required this.onSelected,
  });
  final List<String> labels;
  final int selected;
  final ValueChanged<int> onSelected;
  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    padding: const EdgeInsets.symmetric(horizontal: 20),
    child: Row(
      children: List.generate(
        labels.length,
        (i) => Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Semantics(
            selected: selected == i,
            button: true,
            child: Material(
              color: selected == i ? AppColors.ink : AppColors.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(3),
                side: BorderSide(
                  color: selected == i ? AppColors.ink : AppColors.lineStrong,
                ),
              ),
              child: InkWell(
                borderRadius: BorderRadius.circular(3),
                onTap: () => onSelected(i),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  child: Text(
                    labels[i],
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: .3,
                      color: selected == i
                          ? AppColors.surface
                          : AppColors.inkMuted,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class ProviderMark extends StatelessWidget {
  const ProviderMark(this.name, {super.key, this.size = 28});
  final String name;
  final double size;
  @override
  Widget build(BuildContext context) => switch (name) {
    'OpenAI' => Icon(Icons.hub_outlined, size: size, color: AppColors.ink),
    'Claude' => Icon(
      Icons.auto_awesome_outlined,
      size: size,
      color: AppColors.accent,
    ),
    'Google' => Text(
      'G',
      style: TextStyle(
        fontSize: size,
        fontWeight: FontWeight.w800,
        color: AppColors.info,
      ),
    ),
    'Meta' => Icon(
      Icons.all_inclusive,
      size: size,
      color: AppColors.info,
    ),
    _ => Icon(Icons.circle_outlined, size: size, color: AppColors.inkMuted),
  };
}

/// The AI Hub mark: a waypoint / compass stamp — a ring with a single
/// rust-colored bearing needle, not a rotating cast of gradient shapes.
/// Reads as "your one fixed point among many providers/tools" and works
/// identically at nav-icon size and splash size because it's just three
/// flat shapes, no gradients to band or blur when scaled.
/// Mirrored pixel-for-pixel in web/public/ui.js's logoSvg().
class HubLogo extends StatelessWidget {
  const HubLogo({super.key, this.size = 116});
  final double size;
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'AI Hub mark',
    image: true,
    child: CustomPaint(size: Size.square(size), painter: _HubLogoPainter()),
  );
}

class _HubLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final r = size.width * .41;

    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * .055
      ..color = AppColors.ink;
    canvas.drawCircle(center, r, ring);

    // Faint tick marks around the ring — a compass rose gesture without
    // drawing 360 individual ticks.
    final tick = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * .01
      ..strokeCap = StrokeCap.round
      ..color = AppColors.ink.withValues(alpha: .35);
    for (var i = 0; i < 24; i++) {
      final a = i * (math.pi * 2 / 24);
      final dir = Offset(math.cos(a), math.sin(a));
      canvas.drawLine(center + dir * (r + 2), center + dir * (r + 9), tick);
    }

    // The needle: one solid rust kite shape pointing north, ink counter-
    // weight pointing south — a single confident accent, not a gradient.
    final north = center + Offset(0, -r * .82);
    final south = center + Offset(0, r * .82);
    final east = center + Offset(r * .28, 0);
    final west = center + Offset(-r * .28, 0);

    final needleFront = Path()
      ..moveTo(north.dx, north.dy)
      ..lineTo(east.dx, east.dy)
      ..lineTo(west.dx, west.dy)
      ..close();
    canvas.drawPath(needleFront, Paint()..color = AppColors.accent);

    final needleBack = Path()
      ..moveTo(south.dx, south.dy)
      ..lineTo(east.dx, east.dy)
      ..lineTo(west.dx, west.dy)
      ..close();
    canvas.drawPath(needleBack, Paint()..color = AppColors.ink);

    canvas.drawCircle(
      center,
      size.width * .05,
      Paint()..color = AppColors.surface,
    );
    canvas.drawCircle(
      center,
      size.width * .05,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = size.width * .035
        ..color = AppColors.ink,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ---------------------------------------------------------------------
// Simple flat backdrop: warm paper, no wavy gradient blobs. Splash and
// any other full-bleed screen just sit on the app's normal background.
class AuroraBackdrop extends StatelessWidget {
  const AuroraBackdrop({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    color: AppColors.bg,
    child: child,
  );
}
