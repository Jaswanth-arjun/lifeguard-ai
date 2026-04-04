import 'dart:math';
import 'package:flutter/material.dart';

class HeartbeatLine extends StatefulWidget {
  final Color color;
  const HeartbeatLine({super.key, this.color = const Color(0xFF39FF14)});

  @override
  State<HeartbeatLine> createState() => _HeartbeatLineState();
}

class _HeartbeatLineState extends State<HeartbeatLine> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return CustomPaint(
          size: const Size(double.infinity, 40),
          painter: _HeartbeatPainter(
            animationValue: _controller.value,
            color: widget.color,
          ),
        );
      },
    );
  }
}

class _HeartbeatPainter extends CustomPainter {
  final double animationValue;
  final Color color;

  _HeartbeatPainter({required this.animationValue, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;

    final glowPaint = Paint()
      ..color = color.withOpacity(0.3)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.0
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);

    final path = Path();
    final step = size.width / 100;
    
    for (double x = 0; x <= size.width; x += step) {
      // Create a moving sine/zigzag wave
      final relativeX = (x / size.width + animationValue) % 1.0;
      double y = size.height / 2;

      // Pulse logic
      if (relativeX > 0.4 && relativeX < 0.6) {
        final localX = (relativeX - 0.4) / 0.2; // 0 to 1
        if (localX < 0.2) y -= localX * 50;
        else if (localX < 0.4) y += (localX - 0.2) * 100 - 10;
        else if (localX < 0.6) y -= (localX - 0.4) * 80 + 10;
        else if (localX < 0.8) y += (localX - 0.6) * 40 - 10;
      }

      if (x == 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }

    canvas.drawPath(path, glowPaint);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _HeartbeatPainter oldDelegate) => true;
}
