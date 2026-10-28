import 'package:flutter/material.dart';

import 'app.dart';
import 'core/app_state.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final state = await AppState.create();
  runApp(PostAssistApp(state: state));
}
