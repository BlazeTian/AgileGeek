/// Whether this build talks to the services an earlier release did: its
/// update feed, its usage reports and diagnostics, and the upstreams listed
/// on its site.
///
/// None of them is served for AgileGeek yet, so each is off here and the
/// code that runs them stays whole: publishing a feed turns one back on.
/// A release that enables one must also point its URL at a host of its own.
library;

/// Whether the app looks for, downloads and installs new versions.
///
/// Off: no manifest is read, nothing is downloaded, and Settings → Updates
/// says this build does not update itself.
const agileGeekUpdatesEnabled = false;

/// Where an update manifest would be read; used only when
/// [agileGeekUpdatesEnabled] is true.
const agileGeekManifestUrl = 'https://dl.agilegeek.dev/releases/latest.json';

/// Whether the daily, anonymous usage report is sent. Off: nothing leaves
/// the machine.
const agileGeekTelemetryEnabled = false;

/// Where such a report would go; used only when
/// [agileGeekTelemetryEnabled] is true.
const agileGeekTelemetryUrl = 'https://stats.agilegeek.dev/v1/ping';

/// Whether the diagnostics a user sends on purpose can be uploaded. Off:
/// they can still be saved to a file and sent by hand.
const agileGeekDiagnosticsUploadEnabled = false;

/// Whether the upstream cards on Settings → Models are read from the site.
///
/// Off: no card is shown and no page is fetched. One-click import
/// (`agilegeek://provider/import`) still works from a link a site builds.
const agileGeekFeaturedUpstreamsEnabled = false;

/// The project's home, as the app links to it: the About page, a new
/// version's notification, the commit and pull request lines an agent may
/// write.
const agileGeekWebsite = 'https://github.com/BlazeTian/AgileGeek';
