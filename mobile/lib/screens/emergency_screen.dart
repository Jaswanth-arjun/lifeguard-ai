import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../models/health_models.dart';
import '../providers/health_provider.dart';

class EmergencyScreen extends StatelessWidget {
  const EmergencyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final health = context.watch<HealthProvider>();
    final vitals = health.vitals;

    return Scaffold(
      backgroundColor: const Color(0xFF020408),
      body: Stack(
        children: [
          // Background Glow
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topCenter,
                  radius: 1.5,
                  colors: [
                    const Color(0xFFFF003C).withOpacity(0.1),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          SafeArea(
            child: Column(
              children: [
                _buildHeader(context),
                _buildVitalStats(vitals),
                
                Expanded(
                  child: Container(
                    margin: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.white.withOpacity(0.1)),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                      child: FlutterMap(
                        options: MapOptions(
                          initialCenter: const LatLng(40.7128, -74.0060), // Demo NYC
                          initialZoom: 13.0,
                        ),
                        children: [
                          TileLayer(
                            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            userAgentPackageName: 'com.lifeguard.mobile',
                            tileBuilder: (context, tileWidget, tile) {
                              return ColorFiltered(
                                colorFilter: const ColorFilter.matrix([
                                  -1,  0,  0, 0, 255,
                                   0, -1,  0, 0, 255,
                                   0,  0, -1, 0, 255,
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
                                child: Icon(Icons.person_pin_circle, color: Color(0xFF00C8FF), size: 40),
                              ),
                              Marker(
                                point: LatLng(40.7328, -73.9860),
                                width: 40,
                                height: 40,
                                child: Icon(Icons.local_hospital, color: Color(0xFFFF003C), size: 40),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                _buildActionPanel(context, health),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const Icon(Icons.warning_amber_rounded, color: Color(0xFFFF003C), size: 64),
          const SizedBox(height: 16),
          const Text(
            "CRITICAL ALERT",
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: Color(0xFFFF003C),
              letterSpacing: 2,
              fontFamily: 'Outfit',
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "High risk detected. Medical help is required.",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: Colors.white.withOpacity(0.6)),
          ),
        ],
      ),
    );
  }

  Widget _buildVitalStats(Vitals vitals) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildMiniStat("HR", vitals.heartRate.toStringAsFixed(0), const Color(0xFFFF003C)),
          _buildMiniStat("SpO2", "${vitals.spo2.toStringAsFixed(0)}%", const Color(0xFF00C8FF)),
          _buildMiniStat("TEMP", "${vitals.temperatureC.toStringAsFixed(1)}°C", const Color(0xFFFFEA00)),
        ],
      ),
    );
  }

  Widget _buildMiniStat(String label, String value, Color color) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white38)),
        const SizedBox(height: 4),
        Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: color)),
      ],
    );
  }

  Widget _buildActionPanel(BuildContext context, HealthProvider health) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => health.resumeNormal(),
              icon: const Icon(Icons.check_circle_outline),
              label: const Text("I AM SAFE / ACKNOWLEDGE"),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white.withOpacity(0.1),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {}, // Future: Actual 911 call
              icon: const Icon(Icons.phone_in_talk),
              label: const Text("CALL EMERGENCY SERVICES"),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFF003C),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
