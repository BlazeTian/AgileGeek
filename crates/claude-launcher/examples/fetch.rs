//! Downloads the newest Claude Code into the app's data directory.
//! Run with `cargo run -p agilegeek-launcher --example fetch`.

use agilegeek_core::AppPaths;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let paths = AppPaths::new(None)?;
    println!("data dir: {}", paths.root().display());

    let release = agilegeek_launcher::latest_release().await?;
    println!("latest: {}", release.version);
    println!("unpacked size: {:?}", release.unpacked_size);

    let last = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
    let seen = last.clone();
    let exe = agilegeek_launcher::install(&paths, &release, move |progress| match progress {
        agilegeek_launcher::Progress::Downloaded { so_far, total } => {
            let before = seen.load(std::sync::atomic::Ordering::Relaxed);
            if so_far - before > 20 * 1024 * 1024 {
                seen.store(so_far, std::sync::atomic::Ordering::Relaxed);
                println!("  {so_far} / {total} bytes");
            }
        }
        agilegeek_launcher::Progress::Unpacking => println!("unpacking"),
        agilegeek_launcher::Progress::Done { path } => println!("installed {}", path.display()),
        _ => {}
    })
    .await?;

    println!("version: {:?}", agilegeek_launcher::download::version_of(&exe).await);
    Ok(())
}
