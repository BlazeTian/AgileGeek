/// The services this build talks to, and where each lives.
///
/// All of them are AgileGeek's own, on a server of its own. They are spoken
/// to by address rather than by name: no certificate, and so no domain, and
/// nothing that needs one registered before an update can ship.
///
/// That is plain http on the wire. What an update installs is still checked
/// against a signature the server's answer cannot alter (see
/// `UpdateUrlPolicy`), so a transfer altered on its way is refused rather
/// than installed. The logs a user sends on purpose are not signed: what
/// they say is readable between here and there, which is why sending them is
/// a button the user presses, never something the app does by itself.
///
/// A name with a certificate of its own is the other way, and it is what to
/// move to when there is one: point [agileGeekServerHost] at it, set
/// [agileGeekServerSecure] true, and drop [agileGeekServerPort] (a
/// certificate is checked on 443 alone).
library;

/// Where the server is: its address, and the port it answers on.
const agileGeekServerHost = '43.142.179.88';

/// The port the server answers on. Not 80 or 443: those are the ones a
/// machine in some places may not serve a name on without it being
/// registered first, and this build needs neither.
const agileGeekServerPort = 8080;

/// Whether the server is reached over https (it needs a certificate for
/// [agileGeekServerHost] then, and is reached on 443).
const agileGeekServerSecure = false;

/// The server's base: `http://<address>:<port>`, or `https://<address>`.
const agileGeekServer = agileGeekServerSecure
    ? 'https://$agileGeekServerHost'
    : 'http://$agileGeekServerHost:$agileGeekServerPort';

/// Whether the app looks for, downloads and installs new versions.
///
/// Off: no manifest is read, nothing is downloaded, and Settings → Updates
/// says this build does not update itself.
const agileGeekUpdatesEnabled = true;

/// Where the update manifest is read; used only when
/// [agileGeekUpdatesEnabled] is true.
const agileGeekManifestUrl = '$agileGeekServer/releases/latest.json';

/// Whether the daily, anonymous usage report is sent. Off: nothing leaves
/// the machine.
const agileGeekTelemetryEnabled = true;

/// Where such a report goes; used only when [agileGeekTelemetryEnabled].
const agileGeekTelemetryUrl = '$agileGeekServer/v1/ping';

/// Whether the diagnostics a user sends on purpose can be uploaded. Off:
/// they can still be saved to a file and sent by hand.
///
/// Off by default: they are not signed, and the connection carries them in
/// the clear (see this library's note). Turned on where the server is
/// reached over https.
const agileGeekDiagnosticsUploadEnabled = agileGeekServerSecure;

/// Where a release's notes are read, the page the download button opens on
/// a build that cannot update itself.
const agileGeekDownloadPage = agileGeekServer;

/// Where a diagnostics bundle goes; used only when
/// [agileGeekDiagnosticsUploadEnabled].
const agileGeekDiagnosticsUrl = '$agileGeekServer/v1/diagnostics';

/// Whether the upstream cards on Settings → Models are read from the server.
///
/// Off: no card is shown and no page is fetched. One-click import
/// (`agilegeek://provider/import`) still works from a link a site builds.
const agileGeekFeaturedUpstreamsEnabled = true;

/// Where the featured upstreams are read from.
const agileGeekFeaturedUrl = '$agileGeekServer/featured/upstreams.json';

/// The project's home, as the app links to it: the About page, a new
/// version's notification, the commit and pull request lines an agent may
/// write.
const agileGeekWebsite = 'https://github.com/BlazeTian/AgileGeek';

/// The public notes page, when there is one; null while there is none (a
/// release note opens the changelog file in the app instead).
const String? agileGeekChangelogUrl = null;
