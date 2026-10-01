import 'package:flutter/material.dart';

import '../theme.dart';

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
    color: Colors.transparent,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(14),
      side: BorderSide.none,
    ),
    child: Ink(
      decoration: BoxDecoration(
        gradient: AppColors.gradient,
        borderRadius: BorderRadius.circular(14),
      ),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(14),
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
    ),
  );
}

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
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: fill ?? AppColors.surface,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: AppColors.line),
      boxShadow: const [
        BoxShadow(
          color: Color(0x0D244B95),
          blurRadius: 22,
          offset: Offset(0, 5),
        ),
      ],
    ),
    child: Material(
      color: Colors.transparent,
      child: Padding(padding: padding, child: child),
    ),
  );
}

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
      borderRadius: BorderRadius.circular(14),
      color: solid ? color : color.withValues(alpha: .10),
      border: solid ? null : Border.all(color: AppColors.line),
    ),
    child: Icon(
      icon,
      color: solid ? AppColors.surface : color,
      size: size * .52,
    ),
  );
}

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
              color: selected == i ? AppColors.accent : AppColors.surfaceSunken,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: BorderSide(
                  color: selected == i ? AppColors.accent : AppColors.line,
                ),
              ),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
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
    'Meta' => Icon(Icons.all_inclusive, size: size, color: AppColors.info),
    _ => Icon(Icons.circle_outlined, size: size, color: AppColors.inkMuted),
  };
}

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
    canvas.save();
    canvas.scale(size.width / 100, size.height / 100);
    final line = Paint()
      ..color = const Color(0xFF4275FF)
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(const Offset(20, 48), const Offset(64, 12), line);
    canvas.drawLine(const Offset(20, 84), const Offset(74, 42), line);
    canvas.drawLine(const Offset(44, 64), const Offset(76, 84), line);
    const nodes = [
      Offset(64, 12),
      Offset(20, 48),
      Offset(74, 42),
      Offset(44, 64),
      Offset(20, 84),
      Offset(76, 84),
    ];
    for (final node in nodes) {
      final fill = Paint()
        ..shader = AppColors.gradient.createShader(
          Rect.fromCircle(center: node, radius: 14),
        );
      canvas.drawCircle(node, 10, fill);
      canvas.drawCircle(
        node,
        10,
        Paint()
          ..color = AppColors.accent
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1,
      );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class AuroraBackdrop extends StatelessWidget {
  const AuroraBackdrop({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Colors.white, AppColors.bg, Color(0xFFF0EAFF)],
      ),
    ),
    child: Stack(
      children: [
        Positioned(
          right: -90,
          top: -70,
          child: _orb(260, const Color(0xFFDDF5FF)),
        ),
        Positioned(
          left: -120,
          bottom: 40,
          child: _orb(320, const Color(0xFFE0E9FF)),
        ),
        Positioned(
          right: -60,
          bottom: -130,
          child: _orb(300, const Color(0xFFE8DEFF)),
        ),
        child,
      ],
    ),
  );

  Widget _orb(double size, Color color) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)]),
    ),
  );
}
