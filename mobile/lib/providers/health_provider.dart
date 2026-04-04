import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/health_models.dart';
import '../services/recommendation_engine.dart';

class HealthProvider with ChangeNotifier {
  Vitals _vitals = Vitals();
  Prediction? _prediction;
  List<Recommendation> _recommendations = [];
  bool _isEmergency = false;
  bool _forceAbnormal = false;
  String? _error;

  // History for charts
  final List<double> hrHistory = [];
  final List<int> riskHistory = [];

  Vitals get vitals => _vitals;
  Prediction? get prediction => _prediction;
  List<Recommendation> get recommendations => _recommendations;
  bool get isEmergency => _isEmergency;
  String? get error => _error;

  Timer? _timer;
  final _random = Random();

  static const String _apiFromEnv = String.fromEnvironment('API_BASE_URL', defaultValue: '');

  // API configuration:
  // - Web/desktop: localhost
  // - Android emulator: 10.0.2.2 (host loopback)
  // - Override for any target: --dart-define=API_BASE_URL=http://host:5000/api
  String get _baseUrl {
    if (_apiFromEnv.isNotEmpty) return _apiFromEnv;
    return kIsWeb ? "http://127.0.0.1:5000/api" : "http://10.0.2.2:5000/api";
  }

  HealthProvider() {
    _startSimulation();
  }

  void _startSimulation() {
    _timer = Timer.periodic(const Duration(milliseconds: 2500), (timer) async {
      _updateVitals();
      await _fetchPrediction();
      _processRecommendations();
      notifyListeners();
    });
  }

  void _updateVitals() {
    if (_forceAbnormal) {
      _vitals = _vitals.copyWith(
        heartRate: 132,
        spo2: 84.5,
        temperatureC: 39.2,
      );
    } else {
      _vitals = _vitals.copyWith(
        heartRate: _randomWalk(_vitals.heartRate, 4, 55, 115),
        spo2: _randomWalk(_vitals.spo2, 0.5, 94, 100),
        temperatureC: _randomWalk(_vitals.temperatureC, 0.1, 36.1, 37.8),
      );
    }
    
    // Update history
    hrHistory.add(_vitals.heartRate);
    if (hrHistory.length > 60) hrHistory.removeAt(0);
  }

  double _randomWalk(double prev, double delta, double minV, double maxV) {
    double next = prev + (_random.nextDouble() * 2 - 1) * delta;
    return next.clamp(minV, maxV);
  }

  Future<void> _fetchPrediction() async {
    try {
      final response = await http.post(
        Uri.parse("$_baseUrl/predict"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode(_vitals.toJson()),
      );

      if (response.statusCode == 200) {
        _prediction = Prediction.fromJson(jsonDecode(response.body));
        _error = null;
        
        // Update risk history
        riskHistory.add(_prediction!.riskScore);
        if (riskHistory.length > 60) riskHistory.removeAt(0);

        if (_prediction!.category == "High Risk") {
          _isEmergency = true;
        } else {
          _isEmergency = false;
        }
      }
    } catch (e) {
      _error = "API Connection Failed";
      if (kDebugMode) print("Prediction Error: $e");
    }
  }

  void _processRecommendations() {
    _recommendations = RecommendationEngine.generate(_vitals, _prediction);
  }

  void updateMedicalHistory(int value) {
    _vitals = _vitals.copyWith(medicalHistory: value);
    notifyListeners();
  }

  void updateLifestyleScore(int value) {
    _vitals = _vitals.copyWith(lifestyleScore: value);
    notifyListeners();
  }

  void simulateEmergency() {
    _forceAbnormal = true;
    notifyListeners();
  }

  void resumeNormal() {
    _forceAbnormal = false;
    _isEmergency = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
