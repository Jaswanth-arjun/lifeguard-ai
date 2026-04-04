import 'dart:math';
import 'package:flutter/material.dart';

class VitalsGauge extends StatelessWidget {
  final double value;
  final double min;
  final double max;
  final String label;
  final String unit;
  final Color color;
  final Color glowColor;

  const VitalsGauge({
    super.key,
    required this.value,
    required this.min,
    required this.max,
    required this.label,
    required this.unit,
    required this.color,
    required this.glowColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 140,
          height: 140,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Outer Ambient Glow
              Container(
                width: 110,
                height: 110,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: glowColor.withOpacity(0.1),
                      blurRadius: 40,
                      spreadRadius: 8,
                    ),
                  ],
                ),
              ),
              // Gauge Painter
              CustomPaint(
                size: const Size(110, 110),
                painter: _GaugePainter(
                  value: value,
                  min: min,
                  max: max,
                  color: color,
                  glowColor: glowColor,
                ),
              ),
              // Value Text
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    value.toStringAsFixed(value < 100 ? 1 : 0),
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      fontFamily: 'Outfit',
                      shadows: [
                        Shadow(color: glowColor.withOpacity(0.6), blurRadius: 15),
                      ],
                    ),
                  ),
                  Text(
                    unit,
                    style: TextStyle(
                      fontSize: 10,
                      color: Colors.white.withOpacity(0.5),
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Text(
          label.toUpperCase(),
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: Colors.white.withOpacity(0.4),
            letterSpacing: 1.8,
          ),
        ),
      ],
    );
  }
}

class _GaugePainter extends CustomPainter {
  final double value;
  final double min;
  final double max;
  final Color color;
  final Color glowColor;

  _GaugePainter({
    required this.value,
    required this.min,
    required this.max,
    required this.color,
    required this.glowColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    const strokeWidth = 11.0;

    // Background track (Abyss blue glass)
    final paintBase = Paint()
      ..color = const Color(0xFF0C142A).withOpacity(0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      0.75 * pi,
      1.5 * pi,
      false,
      paintBase,
    );

    // Active track
    final progress = (value - min) / (max - min);
    
    // Layer 1: Glow
    final paintGlow = Paint()
      ..color = glowColor.withOpacity(0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth + 4
      ..strokeCap = StrokeCap.round
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      0.75 * pi,
      (1.5 * pi) * progress.clamp(0.01, 1.0),
      false,
      paintGlow,
    );

    // Layer 2: Solid core
    final paintActive = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      0.75 * pi,
      (1.5 * pi) * progress.clamp(0.01, 1.0),
      false,
      paintActive,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
