import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../providers/health_provider.dart';
import '../widgets/vitals_gauge.dart';
import '../widgets/live_trends_chart.dart';
import '../widgets/recommendation_card.dart';
import '../widgets/heartbeat_line.dart';
import '../widgets/glass_card.dart';
import 'emergency_screen.dart';
import 'summary_screen.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final health = context.watch<HealthProvider>();
    final vitals = health.vitals;
    final prediction = health.prediction;
    final cat = prediction?.category ?? "Normal";

    if (health.isEmergency) {
      return const EmergencyScreen();
    }

    return Scaffold(
      backgroundColor: const Color(0xFF030711),
      body: Container(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.topLeft,
            radius: 1.5,
            colors: [
              const Color(0xFFB14CFA).withOpacity(0.08),
              Colors.transparent,
            ],
          ),
        ),
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            _buildAppBar(context, cat),
            
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Heartbeat Line
                  const HeartbeatLine(),
                  const SizedBox(height: 16),

                  // Vitals Grid (2x2)
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.95,
                    children: [
                      GlassCard(
                        padding: const EdgeInsets.all(12),
                        child: VitalsGauge(
                          value: vitals.heartRate,
                          min: 40,
                          max: 180,
                          label: "Heart Rate",
                          unit: "BPM",
                          color: vitals.heartRate > 120 ? const Color(0xFFFF003C) : vitals.heartRate > 100 ? const Color(0xFFFFEA00) : const Color(0xFF39FF14),
                          glowColor: vitals.heartRate > 120 ? const Color(0xFFFF003C) : vitals.heartRate > 100 ? const Color(0xFFFFEA00) : const Color(0xFF39FF14),
                        ),
                      ),
                      GlassCard(
                        padding: const EdgeInsets.all(12),
                        child: VitalsGauge(
                          value: vitals.spo2,
                          min: 80,
                          max: 100,
                          label: "SpO2",
                          unit: "%",
                          color: vitals.spo2 < 90 ? const Color(0xFFFF003C) : vitals.spo2 < 95 ? const Color(0xFFFFEA00) : const Color(0xFF00C8FF),
                          glowColor: const Color(0xFF00C8FF),
                        ),
                      ),
                      GlassCard(
                        padding: const EdgeInsets.all(12),
                        child: VitalsGauge(
                          value: vitals.temperatureC,
                          min: 35,
                          max: 41,
                          label: "Body Temp",
                          unit: "°C",
                          color: vitals.temperatureC > 38.5 ? const Color(0xFFFF003C) : vitals.temperatureC > 37.5 ? const Color(0xFFFFEA00) : const Color(0xFF4DC9F6),
                          glowColor: const Color(0xFF4DC9F6),
                        ),
                      ),
                      GlassCard(
                        padding: const EdgeInsets.all(12),
                        borderColor: _getRiskColor(cat).withOpacity(0.3),
                        child: VitalsGauge(
                          value: prediction?.riskScore.toDouble() ?? 0.0,
                          min: 0,
                          max: 100,
                          label: "AI Risk Score",
                          unit: "/ 100",
                          color: _getRiskColor(cat),
                          glowColor: _getRiskColor(cat),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // Recommendations
                  _buildSectionLabel("🩺 AI Health Recommendations"),
                  const SizedBox(height: 12),
                  if (health.recommendations.isEmpty)
                    const Center(child: CircularProgressIndicator(strokeWidth: 2))
                  else
                    ...health.recommendations.map((rec) => RecommendationCard(recommendation: rec)).toList(),

                  const SizedBox(height: 24),

                  // Personalization Sliders
                  _buildSectionLabel("⚙️ Personalization"),
                  const SizedBox(height: 12),
                  GlassCard(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        _buildSliderRow("Medical History", vitals.medicalHistory, (v) => health.updateMedicalHistory(v.toInt())),
                        const Divider(color: Colors.white10, height: 32),
                        _buildSliderRow("Lifestyle Score", vitals.lifestyleScore, (v) => health.updateLifestyleScore(v.toInt())),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Action Buttons
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () => health.simulateEmergency(),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFFF003C).withOpacity(0.12),
                            foregroundColor: const Color(0xFFFF003C),
                            side: const BorderSide(color: Color(0xFFFF003C), width: 1.2),
                            padding: const EdgeInsets.symmetric(vertical: 18),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: const Text("⚡ SIMULATE EMERGENCY", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 1.2)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SummaryScreen())),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF00C8FF).withOpacity(0.12),
                            foregroundColor: const Color(0xFF00C8FF),
                            side: const BorderSide(color: Color(0xFF00C8FF), width: 1.2),
                            padding: const EdgeInsets.symmetric(vertical: 18),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: const Text("📊 VIEW SUMMARY", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 1.2)),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 32),

                  // Trends Chart
                  _buildSectionLabel("📈 Live Trends"),
                  const SizedBox(height: 12),
                  GlassCard(
                    padding: const EdgeInsets.fromLTRB(12, 28, 20, 16),
                    child: LiveTrendsChart(
                      hrHistory: health.hrHistory,
                      riskHistory: health.riskHistory,
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Map Section
                  _buildSectionLabel("🗺️ Live Location & Hospital Map"),
                  const SizedBox(height: 12),
                  GlassCard(
                    padding: EdgeInsets.zero,
                    child: SizedBox(
                      height: 250,
                      child: Column(
                        children: [
                          Expanded(
                            child: ClipRRect(
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                              child: FlutterMap(
                                options: const MapOptions(
                                  initialCenter: LatLng(40.7128, -74.0060),
                                  initialZoom: 12.0,
                                ),
                                children: [
                                  TileLayer(
                                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                    userAgentPackageName: 'com.lifeguard.mobile',
                                    // Custom Dark Filter
                                    tileBuilder: (context, tileWidget, tile) {
                                      return ColorFiltered(
                                        colorFilter: const ColorFilter.matrix([
                                          -0.9,  0,  0, 0, 255,
                                           0, -0.9,  0, 0, 255,
                                           0,  0, -0.9, 0, 255,
                                           0,  0,  0, 1,   0,
                                        ]),
                                        child: tileWidget,
                                      );
                                    },
                                  ),
                                  const MarkerLayer(
                                    markers: [
                                      Marker(
                                        point: LatLng(40.7128, -74.0060),
                                        width: 40,
                                        height: 40,
                                        child: Icon(Icons.person_pin_circle, color: Color(0xFF00C8FF), size: 32),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                const Icon(Icons.info_outline, size: 14, color: Colors.white38),
                                const SizedBox(width: 8),
                                Text(
                                  "GPS: Active · Nearest hospital identified",
                                  style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.35), letterSpacing: 0.5),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 100),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context, String riskCat) {
    return SliverAppBar(
      backgroundColor: const Color(0xFF030711).withOpacity(0.8),
      pinned: true,
      expandedHeight: 80,
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              "Lifeguard AI",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white, fontFamily: 'Outfit'),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: _getRiskColor(riskCat).withOpacity(0.12),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: _getRiskColor(riskCat).withOpacity(0.4)),
              ),
              child: Text(
                riskCat.toUpperCase(),
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: _getRiskColor(riskCat), letterSpacing: 1.2),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionLabel(String label) {
    return Text(
      label.toUpperCase(),
      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white38, letterSpacing: 2),
    );
  }

  Widget _buildSliderRow(String label, int value, Function(double) onChanged) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white70)),
            Text("$value / 10", style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white)),
          ],
        ),
        Slider(
          value: value.toDouble(),
          min: 0,
          max: 10,
          activeColor: const Color(0xFF00C8FF),
          inactiveColor: Colors.white.withOpacity(0.08),
          onChanged: onChanged,
        ),
      ],
    );
  }

  Color _getRiskColor(String? cat) {
    if (cat == "High Risk") return const Color(0xFFFF003C);
    if (cat == "Warning") return const Color(0xFFFFEA00);
    return const Color(0xFF39FF14);
  }
}
