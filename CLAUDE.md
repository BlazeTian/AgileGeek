# AGENT

- Reply to the user using their current natural language
- After changing code, run only the tests related to the change. The full test suite is slow and bogs down the machine, so don't run it casually.
- This fork (AgileGeek) keeps upstream's code whole: services pointed at upstream's servers are switched off in `lib/platform/fork_services.dart`, not deleted. See `docs/fork.md`.
