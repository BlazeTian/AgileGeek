// AgileGeek's own core on its own, run as `claude -p` is, with its
// arguments: `dart run agile_agent -p --input-format stream-json
// --output-format stream-json …`, or one prompt on stdin.
import 'dart:io';

import 'package:agile_agent/agile_agent.dart';

Future<void> main(List<String> arguments) async {
  exit(
    await runAgentCommandLine(
      arguments,
      input: stdin,
      output: stdout,
      errors: stderr,
      cwd: Directory.current.path,
      environment: Platform.environment,
    ),
  );
}
