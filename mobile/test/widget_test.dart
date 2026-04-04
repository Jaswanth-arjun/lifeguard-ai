// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:lifeguard_mobile/main.dart';
import 'package:lifeguard_mobile/providers/health_provider.dart';

void main() {
  testWidgets('Lifeguard app renders dashboard shell', (WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => HealthProvider()),
        ],
        child: const LifeguardApp(),
      ),
    );

    expect(find.text('Lifeguard AI'), findsOneWidget);
  });
}
