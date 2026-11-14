//! Earth Jukebox local server (plan Step 11).
//!
//! Serves the built interface (`web/dist`) and its prepared data
//! (`web/dist/data/`) as static files. No database and no outbound requests:
//! everything the demo needs is on disk, so it runs with the network unplugged
//! (FR2, NFR1). It listens on the loopback interface unless told otherwise.

use std::fmt;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::{Path, PathBuf};

use axum::Router;
use tower_http::services::ServeDir;

/// Folder served when no path is given on the command line.
pub const DEFAULT_DIST: &str = "web/dist";
/// Port used when `JUKEBOX_PORT` is not set.
pub const DEFAULT_PORT: u16 = 8080;

/// Files the interface cannot start without.
const REQUIRED_FILES: [&str; 2] = ["index.html", "data/manifest.json"];

/// Why the served folder cannot be used.
#[derive(Debug, PartialEq, Eq)]
pub enum DistError {
    /// The folder itself does not exist (or is not a folder).
    MissingDir(PathBuf),
    /// The folder exists but a required file is missing.
    MissingFile(PathBuf),
}

impl fmt::Display for DistError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DistError::MissingDir(dir) => write!(
                f,
                "the interface folder {} does not exist. Build the interface first \
                 (`docker compose run --rm web npm run build`) or pass the folder as \
                 the first argument.",
                dir.display()
            ),
            DistError::MissingFile(file) => write!(
                f,
                "{} is missing. Rebuild the interface (`docker compose run --rm web npm \
                 run build`); if data/manifest.json is the one missing, regenerate the \
                 data with `docker compose run --rm prep` and build again.",
                file.display()
            ),
        }
    }
}

impl std::error::Error for DistError {}

/// Checks that `dist` holds a built interface with its data.
pub fn check_dist(dist: &Path) -> Result<(), DistError> {
    if !dist.is_dir() {
        return Err(DistError::MissingDir(dist.to_path_buf()));
    }
    for name in REQUIRED_FILES {
        let file = dist.join(name);
        if !file.is_file() {
            return Err(DistError::MissingFile(file));
        }
    }
    Ok(())
}

/// The router: every request is a static file under `dist`.
///
/// `ServeDir` answers `/` with `index.html` (its default), guesses content
/// types from the extension, refuses paths that climb out of `dist` (plain or
/// percent-encoded), and returns 404 for anything that is not there.
pub fn app(dist: &Path) -> Router {
    Router::new().fallback_service(ServeDir::new(dist))
}

/// Address to listen on, from `JUKEBOX_HOST` and `JUKEBOX_PORT`.
///
/// Defaults to `127.0.0.1:8080`. docker-compose.yml sets the host to `0.0.0.0`
/// inside the container so the published port reaches it, and publishes that
/// port on the host's loopback only. Port 0 asks the system for a free port;
/// the server prints the one it got.
pub fn listen_addr(host: Option<&str>, port: Option<&str>) -> Result<SocketAddr, String> {
    let ip = match host.map(str::trim).filter(|h| !h.is_empty()) {
        None => IpAddr::V4(Ipv4Addr::LOCALHOST),
        Some(h) => h
            .parse()
            .map_err(|_| format!("JUKEBOX_HOST={h} is not an IP address (use 127.0.0.1)"))?,
    };
    let port = match port.map(str::trim).filter(|p| !p.is_empty()) {
        None => DEFAULT_PORT,
        Some(p) => p
            .parse()
            .map_err(|_| format!("JUKEBOX_PORT={p} is not a port number between 0 and 65535"))?,
    };
    Ok(SocketAddr::new(ip, port))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use axum::http::{header, Request, StatusCode};
    use std::fs;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use tower::ServiceExt;

    /// A throwaway folder that is removed when dropped.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> Self {
            static COUNTER: AtomicUsize = AtomicUsize::new(0);
            let n = COUNTER.fetch_add(1, Ordering::SeqCst);
            let dir = std::env::temp_dir()
                .join(format!("jukebox-server-test-{}-{n}", std::process::id()));
            let _ = fs::remove_dir_all(&dir);
            fs::create_dir_all(&dir).unwrap();
            TempDir(dir)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    /// A minimal built interface (`dist/index.html` plus
    /// `dist/data/manifest.json`) inside a throwaway folder, with a
    /// `secret.txt` next to `dist/` that must never be served.
    struct Fixture {
        _root: TempDir,
        dist: PathBuf,
    }

    fn fake_dist() -> Fixture {
        let root = TempDir::new();
        let dist = root.0.join("dist");
        fs::create_dir_all(dist.join("data")).unwrap();
        fs::write(dist.join("index.html"), "<!doctype html><title>Earth Jukebox</title>").unwrap();
        fs::write(dist.join("data/manifest.json"), r#"{"layers":[]}"#).unwrap();
        fs::write(root.0.join("secret.txt"), "secret").unwrap();
        Fixture { _root: root, dist }
    }

    async fn get(dist: &Path, uri: &str) -> (StatusCode, Option<String>, Vec<u8>) {
        let response = app(dist)
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        let status = response.status();
        let content_type = response
            .headers()
            .get(header::CONTENT_TYPE)
            .map(|v| v.to_str().unwrap().to_owned());
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap().to_vec();
        (status, content_type, body)
    }

    #[test]
    fn check_dist_accepts_a_built_interface() {
        let f = fake_dist();
        assert_eq!(check_dist(&f.dist), Ok(()));
    }

    #[test]
    fn check_dist_reports_a_missing_folder() {
        let tmp = TempDir::new();
        let missing = tmp.0.join("dist");
        let err = check_dist(&missing).unwrap_err();
        assert_eq!(err, DistError::MissingDir(missing));
        assert!(err.to_string().contains("npm run build"));
    }

    #[test]
    fn check_dist_reports_missing_data() {
        let f = fake_dist();
        fs::remove_file(f.dist.join("data/manifest.json")).unwrap();
        let err = check_dist(&f.dist).unwrap_err();
        assert_eq!(err, DistError::MissingFile(f.dist.join("data/manifest.json")));
        assert!(err.to_string().contains("docker compose run --rm prep"));
    }

    #[tokio::test]
    async fn serves_index_at_the_root() {
        let f = fake_dist();
        let (status, content_type, body) = get(&f.dist, "/").await;
        assert_eq!(status, StatusCode::OK);
        assert!(content_type.unwrap().starts_with("text/html"));
        assert!(String::from_utf8(body).unwrap().contains("Earth Jukebox"));
    }

    #[tokio::test]
    async fn serves_the_data_files() {
        let f = fake_dist();
        let (status, content_type, body) = get(&f.dist, "/data/manifest.json").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(content_type.as_deref(), Some("application/json"));
        assert_eq!(body, br#"{"layers":[]}"#);
    }

    #[tokio::test]
    async fn unknown_files_are_not_found() {
        let f = fake_dist();
        let (status, _, _) = get(&f.dist, "/data/nope.bin").await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn refuses_paths_outside_the_folder() {
        let f = fake_dist();
        // The file really is one level above dist/, so a traversal that got
        // through would return it.
        assert!(f.dist.join("../secret.txt").is_file());
        for uri in [
            "/../secret.txt",
            "/%2e%2e/secret.txt",
            "/%2E%2E/secret.txt",
            "/..%2fsecret.txt",
            "/%2e%2e%2fsecret.txt",
            "/data/../../secret.txt",
            "/data/%2e%2e/%2e%2e/secret.txt",
            "/..%5csecret.txt",
            "//etc/passwd",
        ] {
            let (status, _, body) = get(&f.dist, uri).await;
            assert_eq!(status, StatusCode::NOT_FOUND, "{uri} must be refused");
            assert_ne!(body, b"secret", "{uri} leaked the file");
        }
    }

    #[test]
    fn listens_on_loopback_by_default() {
        let addr = listen_addr(None, None).unwrap();
        assert_eq!(addr, "127.0.0.1:8080".parse().unwrap());
        assert!(addr.ip().is_loopback());
    }

    #[test]
    fn host_and_port_can_be_overridden() {
        assert_eq!(
            listen_addr(Some("0.0.0.0"), Some("9000")).unwrap(),
            "0.0.0.0:9000".parse().unwrap()
        );
        // Port 0 is allowed: the system picks a free port and main prints it.
        assert_eq!(listen_addr(None, Some("0")).unwrap().port(), 0);
        assert!(listen_addr(Some("localhost-ish"), None).is_err());
        assert!(listen_addr(None, Some("99999")).is_err());
    }
}
