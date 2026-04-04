import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

class LiveTrendsChart extends StatelessWidget {
  final List<double> hrHistory;
  final List<int> riskHistory;

  const LiveTrendsChart({
    super.key,
    required this.hrHistory,
    required this.riskHistory,
  });

  @override
  Widget build(BuildContext context) {
    if (hrHistory.isEmpty) {
      return const Center(child: Text("Waiting for data monitor..."));
    }

    return AspectRatio(
      aspectRatio: 1.8,
      child: LineChart(
        LineChartData(
          gridData: FlGridData(
            show: true,
            drawVerticalLine: true,
            horizontalInterval: 25,
            verticalInterval: 10,
            getDrawingHorizontalLine: (value) => FlLine(
              color: Colors.white.withOpacity(0.04),
              strokeWidth: 0.5,
            ),
            getDrawingVerticalLine: (value) => FlLine(
              color: Colors.white.withOpacity(0.02),
              strokeWidth: 0.5,
            ),
          ),
          titlesData: FlTitlesData(
            show: true,
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            bottomTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                interval: 25,
                reservedSize: 28,
                getTitlesWidget: (value, meta) => Text(
                  value.toInt().toString(),
                  style: const TextStyle(fontSize: 8, color: Colors.white24, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ),
          borderData: FlBorderData(show: false),
          minX: 0,
          maxX: 59,
          minY: 0,
          maxY: 150,
          lineBarsData: [
            // Risk Line (Neon Cyan Glow)
            LineChartBarData(
              spots: riskHistory.asMap().entries.map((e) {
                return FlSpot(e.key.toDouble(), e.value.toDouble());
              }).toList(),
              isCurved: true,
              curveSmoothness: 0.35,
              color: const Color(0xFF00F0FF),
              barWidth: 2.2,
              isStrokeCapRound: true,
              dotData: const FlDotData(show: false),
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(
                  colors: [
                    const Color(0xFF00F0FF).withOpacity(0.12),
                    const Color(0xFF00F0FF).withOpacity(0.01),
                  ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
              shadow: const Shadow(
                color: Color(0x6600F0FF),
                blurRadius: 8,
                offset: Offset(0, 0),
              ),
            ),
            // Heart Rate Line (Muted White)
            LineChartBarData(
              spots: hrHistory.asMap().entries.map((e) {
                return FlSpot(e.key.toDouble(), e.value);
              }).toList(),
              isCurved: true,
              curveSmoothness: 0.35,
              color: Colors.white.withOpacity(0.25),
              barWidth: 1.5,
              isStrokeCapRound: true,
              dotData: const FlDotData(show: false),
            ),
          ],
        ),
        duration: const Duration(milliseconds: 150),
        curve: Curves.linear,
      ),
    );
  }
}
