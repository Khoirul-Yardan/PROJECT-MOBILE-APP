import 'dart:math' as math;

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
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      gradient: AppColors.gradient,
      borderRadius: BorderRadius.circular(17),
      boxShadow: [
        BoxShadow(
          color: AppColors.primary.withValues(alpha: .19),
          blurRadius: 20,
          offset: const Offset(0, 7),
        ),
      ],
    ),
    child: Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(17),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 52),
          child: Padding(
            padding: const EdgeInsets.all(14),
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
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (arrow) ...[
                  const SizedBox(width: 12),
                  const Icon(
                    Icons.arrow_forward_rounded,
                    size: 19,
                    color: Colors.white,
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
    this.padding = const EdgeInsets.all(16),
    this.gradient,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Gradient? gradient;
  @override
  Widget build(BuildContext context) => Container(
    padding: padding,
    decoration: BoxDecoration(
      color: Colors.white,
      gradient: gradient,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: AppColors.border),
      boxShadow: [
        BoxShadow(
          color: AppColors.accentBlue.withValues(alpha: .035),
          blurRadius: 14,
          offset: const Offset(0, 4),
        ),
      ],
    ),
    child: Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(18),
      child: child,
    ),
  );
}

class IconTile extends StatelessWidget {
  const IconTile(
    this.icon, {
    super.key,
    this.color = AppColors.accentBlue,
    this.solid = false,
    this.size = 42,
  });
  final IconData icon;
  final Color color;
  final bool solid;
  final double size;
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(12),
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: solid
            ? [color.withValues(alpha: .65), color]
            : [color.withValues(alpha: .06), color.withValues(alpha: .16)],
      ),
    ),
    child: Icon(icon, color: solid ? Colors.white : color, size: size * .56),
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
          padding: const EdgeInsets.only(right: 7),
          child: Semantics(
            selected: selected == i,
            button: true,
            child: Container(
              decoration: BoxDecoration(
                gradient: selected == i ? AppColors.gradient : null,
                color: selected == i ? null : AppColors.field,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () => onSelected(i),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 14,
                    ),
                    child: Text(
                      labels[i],
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: selected == i
                            ? Colors.white
                            : AppColors.textDark,
                      ),
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
  const ProviderMark(this.name, {super.key, this.size = 30});
  final String name;
  final double size;
  @override
  Widget build(BuildContext context) => switch (name) {
    'OpenAI' => Icon(
      Icons.filter_vintage_outlined,
      size: size,
      color: AppColors.textDark,
    ),
    'Claude' => Icon(Icons.sunny, size: size, color: const Color(0xFFD67B52)),
    'Google' => Text(
      'G',
      style: TextStyle(
        fontSize: size,
        fontWeight: FontWeight.w800,
        color: const Color(0xFF4285F4),
      ),
    ),
    'Meta' => Icon(
      Icons.all_inclusive,
      size: size,
      color: AppColors.accentBlue,
    ),
    _ => Icon(Icons.auto_awesome, size: size, color: AppColors.primary),
  };
}

class HubLogo extends StatelessWidget {
  const HubLogo({super.key, this.size = 116});
  final double size;
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'AI Hub logo',
    image: true,
    child: CustomPaint(size: Size.square(size), painter: _HubLogoPainter()),
  );
}

class _HubLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final paint = Paint()
      ..shader = AppColors.gradient.createShader(rect)
      ..strokeWidth = size.width * .055
      ..strokeCap = StrokeCap.round;
    final center = rect.center;
    final points = List.generate(6, (i) {
      final angle = -math.pi / 2 + i * math.pi / 3;
      return center +
          Offset(math.cos(angle), math.sin(angle)) * (size.width * .39);
    });
    for (var i = 0; i < points.length; i++) {
      canvas.drawLine(points[i], points[(i + 1) % 6], paint);
      final end = points[i] + (points[(i + 1) % 6] - points[i]) * .6;
      final direction = (points[(i + 1) % 6] - points[i]).direction;
      for (final angle in [direction + 2.5, direction - 2.5]) {
        canvas.drawLine(
          end,
          end + Offset(math.cos(angle), math.sin(angle)) * size.width * .08,
          paint,
        );
      }
    }
    for (final point in points) {
      canvas.drawCircle(point, size.width * .09, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class AuroraBackdrop extends StatelessWidget {
  const AuroraBackdrop({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Stack(
    fit: StackFit.expand,
    children: [
      const DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Colors.white, Color(0xFFF0FBFF), Color(0xFFF9F5FF)],
          ),
        ),
      ),
      Positioned.fill(child: CustomPaint(painter: _WavePainter())),
      child,
    ],
  );
}

class _WavePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    for (var i = 0; i < 4; i++) {
      final y = size.height * (.68 + i * .045);
      final path = Path()
        ..moveTo(0, y + 35)
        ..cubicTo(
          size.width * .4,
          y - 100,
          size.width * .52,
          y - 65,
          size.width,
          y + 20,
        )
        ..lineTo(size.width, size.height)
        ..lineTo(0, size.height)
        ..close();
      final paint = Paint()
        ..shader =
            LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.accentCyan.withValues(alpha: .12),
                AppColors.accentBlue.withValues(alpha: .08),
                AppColors.primary.withValues(alpha: .10),
                Colors.white.withValues(alpha: .4),
              ],
            ).createShader(
              Offset(0, y - 100) & Size(size.width, size.height - y + 100),
            );
      canvas.drawPath(path, paint);
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2
          ..color = Colors.white.withValues(alpha: .6),
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
