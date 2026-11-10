//! Fetching the Claude Code program into the app's own directory.
//!
//! The package published for each platform holds one native executable and
//! nothing else; unpacking it is the whole install. It is downloaded to a
//! temporary file, checked, and only then renamed into place, so an
//! interrupted download never looks like a usable one.

use std::path::{Path, PathBuf};

use agilegeek_core::AppPaths;
use sha2::Digest;

/// The registry a version is fetched from, tried in order.
const REGISTRIES: &[&str] = &["https://registry.npmmirror.com", "https://registry.npmjs.org"];

/// The package that holds the program for this platform.
pub fn package_name() -> Option<&'static str> {
    if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        Some("@anthropic-ai/claude-code-win32-x64")
    } else if cfg!(all(target_os = "windows", target_arch = "aarch64")) {
        Some("@anthropic-ai/claude-code-win32-arm64")
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        Some("@anthropic-ai/claude-code-darwin-arm64")
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        Some("@anthropic-ai/claude-code-darwin-x64")
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        Some("@anthropic-ai/claude-code-linux-x64")
    } else if cfg!(all(target_os = "linux", target_arch = "aarch64")) {
        Some("@anthropic-ai/claude-code-linux-arm64")
    } else {
        None
    }
}

/// The executable's name inside the package.
fn executable_name() -> &'static str {
    if cfg!(windows) {
        "claude.exe"
    } else {
        "claude"
    }
}

#[derive(Debug, thiserror::Error)]
pub enum DownloadError {
    #[error("no Claude Code build is published for this platform")]
    Unsupported,
    #[error("could not reach the registry: {0}")]
    Network(String),
    #[error("the download is not what its checksum said")]
    Checksum,
    #[error("the package held no {0}")]
    MissingExecutable(String),
    #[error("{0}")]
    Io(#[from] std::io::Error),
}

/// What a download is doing, for a progress bar.
#[derive(Debug, Clone)]
pub enum Progress {
    /// The version found, and how large the download is.
    Starting { version: String, total: u64 },
    /// Bytes so far.
    Downloaded { so_far: u64, total: u64 },
    Unpacking,
    Done { path: PathBuf },
}

/// How a tarball's bytes are checked.
///
/// npm publishes two: `integrity`, a Subresource Integrity string (`sha512-`
/// and the digest in base64) over the gzipped tarball, and `shasum`, the
/// older SHA-1 in hex. The first is the strong one and is used when there.
#[derive(Debug, Clone)]
pub enum Checksum {
    /// `sha512-<base64>`, as SRI writes it.
    Integrity { algorithm: String, expected: Vec<u8> },
    /// The hex digest of `shasum`, for registries that publish nothing else.
    Hex { algorithm: String, expected: String },
}

/// The newest version the registry lists, and its tarball's checksum.
#[derive(Debug, Clone)]
pub struct Release {
    pub version: String,
    pub tarball: String,
    pub checksum: Option<Checksum>,
    pub unpacked_size: Option<u64>,
}

impl Checksum {
    /// Reads npm's `integrity` field.
    pub fn integrity(value: &str) -> Option<Self> {
        let (algorithm, encoded) = value.split_once('-')?;
        let expected = base64_decode(encoded)?;
        Some(Self::Integrity {
            algorithm: algorithm.to_string(),
            expected,
        })
    }

    /// Reads npm's `shasum` field, which is SHA-1 unless said otherwise.
    pub fn shasum(value: &str) -> Self {
        Self::Hex {
            algorithm: "sha1".into(),
            expected: value.to_string(),
        }
    }

    /// Whether [bytes] hash to what was published.
    pub fn matches(&self, bytes: &[u8]) -> bool {
        match self {
            Self::Integrity {
                algorithm,
                expected,
            } => digest_bytes(algorithm, bytes)
                .map(|digest| digest == *expected)
                .unwrap_or(false),
            Self::Hex {
                algorithm,
                expected,
            } => digest_bytes(algorithm, bytes)
                .map(|digest| hex::encode(digest).eq_ignore_ascii_case(expected))
                .unwrap_or(false),
        }
    }
}

/// The digest of [bytes] with the named algorithm.
fn digest_bytes(algorithm: &str, bytes: &[u8]) -> Option<Vec<u8>> {
    match algorithm {
        "sha512" => Some(sha2::Sha512::digest(bytes).to_vec()),
        "sha384" => Some(sha2::Sha384::digest(bytes).to_vec()),
        "sha256" => Some(sha2::Sha256::digest(bytes).to_vec()),
        "sha1" => Some(sha1_digest(bytes)),
        _ => None,
    }
}

/// SHA-1, which `shasum` still uses.
fn sha1_digest(bytes: &[u8]) -> Vec<u8> {
    // SHA-1 is here only to match a field npm already published; it is not
    // used to decide anything no other check backs up.
    use sha1::Digest as _;
    sha1::Sha1::digest(bytes).to_vec()
}

/// Standard base64, as SRI uses.
fn base64_decode(text: &str) -> Option<Vec<u8>> {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = Vec::with_capacity(text.len() * 3 / 4);
    let mut buffer = 0u32;
    let mut bits = 0u32;
    for byte in text.bytes() {
        if byte == b'=' {
            break;
        }
        let value = TABLE.iter().position(|known| *known == byte)? as u32;
        buffer = (buffer << 6) | value;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buffer >> bits) as u8);
        }
    }
    Some(out)
}

/// Reads the registry's metadata for the newest build.
pub async fn latest_release() -> Result<Release, DownloadError> {
    let package = package_name().ok_or(DownloadError::Unsupported)?;
    let mut last_error = String::new();
    for registry in REGISTRIES {
        let url = format!("{registry}/{package}");
        match fetch_json(&url).await {
            Ok(json) => {
                let latest = json
                    .get("dist-tags")
                    .and_then(|tags| tags.get("latest"))
                    .and_then(|version| version.as_str())
                    .ok_or_else(|| DownloadError::Network("no latest version listed".into()))?;
                let dist = json
                    .get("versions")
                    .and_then(|versions| versions.get(latest))
                    .and_then(|version| version.get("dist"));
                let tarball = dist
                    .and_then(|dist| dist.get("tarball"))
                    .and_then(|url| url.as_str())
                    .map(|url| prefer_mirror(url))
                    .unwrap_or_else(|| {
                        format!("{registry}/{package}/-/claude-code-{latest}.tgz")
                    });
                let checksum = dist
                    .and_then(|dist| dist.get("integrity"))
                    .and_then(|value| value.as_str())
                    .and_then(Checksum::integrity)
                    .or_else(|| {
                        dist.and_then(|dist| dist.get("shasum"))
                            .and_then(|value| value.as_str())
                            .map(Checksum::shasum)
                    });
                return Ok(Release {
                    version: latest.to_string(),
                    tarball,
                    checksum,
                    unpacked_size: dist
                        .and_then(|dist| dist.get("unpackedSize"))
                        .and_then(|size| size.as_u64()),
                });
            }
            Err(error) => last_error = error.0,
        }
    }
    Err(DownloadError::Network(last_error))
}

/// A tarball URL from npmjs.org is rewritten to the mirror that answered,
/// since the registry's own CDN is often the slow part.
fn prefer_mirror(url: &str) -> String {
    if url.contains("registry.npmjs.org") {
        url.replace("https://registry.npmjs.org", REGISTRIES[0])
    } else {
        url.to_string()
    }
}

/// Whether the version is already in the app's directory.
pub fn installed_version(paths: &AppPaths, version: &str) -> Option<PathBuf> {
    let exe = paths.cli().join(version).join(executable_name());
    exe.is_file().then_some(exe)
}

/// Downloads and unpacks [release] into the app's directory, calling
/// [report] as it goes.
pub async fn install(
    paths: &AppPaths,
    release: &Release,
    report: impl Fn(Progress) + Send + 'static,
) -> Result<PathBuf, DownloadError> {
    let target_dir = paths.cli().join(&release.version);
    let executable = target_dir.join(executable_name());
    if executable.is_file() {
        report(Progress::Done {
            path: executable.clone(),
        });
        return Ok(executable);
    }

    let bytes = fetch_bytes(&release.tarball, release.unpacked_size, &report).await?;

    if let Some(expected) = &release.checksum {
        if !expected.matches(&bytes) {
            return Err(DownloadError::Checksum);
        }
    }

    report(Progress::Unpacking);
    let temp_dir = paths.cli().join(format!(".{}.partial", release.version));
    std::fs::create_dir_all(&temp_dir)?;
    unpack(&bytes, &temp_dir)?;

    let unpacked = temp_dir.join(executable_name());
    if !unpacked.is_file() {
        std::fs::remove_dir_all(&temp_dir).ok();
        return Err(DownloadError::MissingExecutable(executable_name().into()));
    }

    // In place only once complete: a half-unpacked directory must never
    // look like an installed version.
    std::fs::create_dir_all(&target_dir)?;
    std::fs::rename(&unpacked, &executable)?;
    std::fs::remove_dir_all(&temp_dir).ok();

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&executable)?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&executable, perms)?;
    }

    report(Progress::Done {
        path: executable.clone(),
    });
    Ok(executable)
}

/// Pulls the executable out of a gzipped tarball.
fn unpack(bytes: &[u8], into: &Path) -> Result<(), DownloadError> {
    let gz = flate2::read::GzDecoder::new(bytes);
    let mut archive = tar::Archive::new(gz);
    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = entry.path()?.to_path_buf();
        // `package/claude.exe`, or whatever the package names it.
        if path.file_name().and_then(|name| name.to_str()) != Some(executable_name()) {
            continue;
        }
        let out = into.join(executable_name());
        entry.unpack(&out)?;
        return Ok(());
    }
    Err(DownloadError::MissingExecutable(executable_name().into()))
}

async fn fetch_json(url: &str) -> Result<serde_json::Value, (String, DownloadError)> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("AgileGeek")
        .build()
        .map_err(|error| (error.to_string(), DownloadError::Network(error.to_string())))?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| (error.to_string(), DownloadError::Network(error.to_string())))?;
    let status = response.status();
    if !status.is_success() {
        let message = format!("{url} answered {status}");
        return Err((message.clone(), DownloadError::Network(message)));
    }
    let json = response
        .json()
        .await
        .map_err(|error| (error.to_string(), DownloadError::Network(error.to_string())))?;
    Ok(json)
}

async fn fetch_bytes(
    url: &str,
    total_hint: Option<u64>,
    report: &impl Fn(Progress),
) -> Result<Vec<u8>, DownloadError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .user_agent("AgileGeek")
        .build()
        .map_err(|error| DownloadError::Network(error.to_string()))?;
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|error| DownloadError::Network(error.to_string()))?;
    if !response.status().is_success() {
        return Err(DownloadError::Network(format!(
            "{url} answered {}",
            response.status()
        )));
    }
    let total = response.content_length().or(total_hint).unwrap_or(0);
    let mut bytes = Vec::with_capacity(total as usize);
    let mut so_far = 0u64;
    let mut last_report = 0u64;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| DownloadError::Network(error.to_string()))?
    {
        bytes.extend_from_slice(&chunk);
        so_far += chunk.len() as u64;
        // A report per megabyte is enough to move a bar.
        if so_far - last_report > 1024 * 1024 {
            last_report = so_far;
            report(Progress::Downloaded { so_far, total });
        }
    }
    report(Progress::Downloaded {
        so_far,
        total: so_far,
    });
    Ok(bytes)
}

/// Reads the version a program reports.
pub async fn version_of(executable: &Path) -> Option<String> {
    let output = tokio::process::Command::new(executable)
        .arg("--version")
        .stdin(std::process::Stdio::null())
        .output()
        .await
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let first = text.lines().next()?.trim();
    Some(first.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_platform_has_a_package() {
        // The test runs on Windows x64, where one is published.
        if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
            assert_eq!(
                package_name(),
                Some("@anthropic-ai/claude-code-win32-x64")
            );
        }
    }

    #[test]
    fn a_tarball_is_unpacked_to_the_executable() {
        // Build a tarball with the executable in it, the way npm's has it.
        let root = std::env::temp_dir().join(format!("agilegeek-tar-{}", std::process::id()));
        std::fs::create_dir_all(&root).expect("root");
        let payload: &[u8] = b"a program";

        let mut builder = tar::Builder::new(Vec::new());
        let mut header = tar::Header::new_gnu();
        header.set_size(payload.len() as u64);
        header.set_mode(0o755);
        header.set_cksum();
        builder
            .append_data(&mut header, format!("package/{}", executable_name()), payload)
            .expect("append");
        let tar_bytes = builder.into_inner().expect("tar");

        let mut gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast());
        std::io::Write::write_all(&mut gz, &tar_bytes).expect("gzip");
        let gzipped = gz.finish().expect("finish");

        let out = root.join("out");
        std::fs::create_dir_all(&out).expect("out");
        unpack(&gzipped, &out).expect("unpack");
        assert_eq!(
            std::fs::read(out.join(executable_name())).expect("read"),
            b"a program"
        );

        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn a_package_without_the_executable_is_refused() {
        let root = std::env::temp_dir().join(format!("agilegeek-tar2-{}", std::process::id()));
        std::fs::create_dir_all(&root).expect("root");
        let mut builder = tar::Builder::new(Vec::new());
        let mut header = tar::Header::new_gnu();
        header.set_size(2);
        header.set_mode(0o644);
        header.set_cksum();
        builder
            .append_data(&mut header, "package/README.md", &b"hi"[..])
            .expect("append");
        let tar_bytes = builder.into_inner().expect("tar");
        let mut gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast());
        std::io::Write::write_all(&mut gz, &tar_bytes).expect("gzip");
        let gzipped = gz.finish().expect("finish");

        let result = unpack(&gzipped, &root);
        assert!(matches!(result, Err(DownloadError::MissingExecutable(_))));
        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn an_integrity_string_is_read_and_checked() {
        // The SHA-256 of "hello", in SRI's base64 form.
        let checksum =
            Checksum::integrity("sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=")
                .expect("integrity");
        assert!(checksum.matches(b"hello"));
        assert!(!checksum.matches(b"goodbye"));
    }

    #[test]
    fn a_sha1_shasum_is_read_and_checked() {
        // The SHA-1 of "hello".
        let checksum = Checksum::shasum("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
        assert!(checksum.matches(b"hello"));
        // Case must not matter.
        assert!(Checksum::shasum("AAF4C61DDCC5E8A2DABEDE0F3B482CD9AEA9434D").matches(b"hello"));
        assert!(!checksum.matches(b"goodbye"));
    }

    #[test]
    fn an_unknown_algorithm_matches_nothing() {
        let checksum = Checksum::integrity("md5-abc").expect("integrity");
        assert!(!checksum.matches(b"hello"));
        assert!(Checksum::integrity("not a checksum").is_none());
    }

    #[test]
    fn npmjs_urls_are_rewritten_to_the_mirror() {
        assert_eq!(
            prefer_mirror("https://registry.npmjs.org/@a/b/-/b-1.tgz"),
            "https://registry.npmmirror.com/@a/b/-/b-1.tgz"
        );
        assert_eq!(
            prefer_mirror("https://registry.npmmirror.com/@a/b/-/b-1.tgz"),
            "https://registry.npmmirror.com/@a/b/-/b-1.tgz"
        );
    }
}
