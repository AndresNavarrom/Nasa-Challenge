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
/// `ServeDir` answers `/` with `index.html`, guesses content types from the
/// extension, refuses paths that climb out of `dist`, and returns 404 for
/// anything that is not there.
pub fn app(dist: &Path) -> Router {
    Router::new().fallback_service(ServeDir::new(dist).append_index_html_on_directories(true))
}

/// Address to listen on, from `JUKEBOX_HOST` and `JUKEBOX_PORT`.
///
/// Defaults to `127.0.0.1:8080`. Inside a container the host is set to
/// `0.0.0.0` so the published port reaches it; docker-compose.yml publishes
/// that port on the host's loopback only.
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

    /// A minimal built interface: index.html plus data/manifest.json.
    fn fake_dist() -> TempDir {
        let tmp = TempDir::new();
        fs::create_dir_all(tmp.0.join("data")).unwrap();
        fs::write(tmp.0.join("index.html"), "<!doctype html><title>Earth Jukebox</title>").unwrap();
        fs::write(tmp.0.join("data/manifest.json"), r#"{"layers":[]}"#).unwrap();
        tmp
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
        let dist = fake_dist();
        assert_eq!(check_dist(&dist.0), Ok(()));
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
        let dist = fake_dist();
        fs::remove_file(dist.0.join("data/manifest.json")).unwrap();
        let err = check_dist(&dist.0).unwrap_err();
        assert_eq!(err, DistError::MissingFile(dist.0.join("data/manifest.json")));
        assert!(err.to_string().contains("docker compose run --rm prep"));
    }

    #[tokio::test]
    async fn serves_index_at_the_root() {
        let dist = fake_dist();
        let (status, content_type, body) = get(&dist.0, "/").await;
        assert_eq!(status, StatusCode::OK);
        assert!(content_type.unwrap().starts_with("text/html"));
        assert!(String::from_utf8(body).unwrap().contains("Earth Jukebox"));
    }

    #[tokio::test]
    async fn serves_the_data_files() {
        let dist = fake_dist();
        let (status, content_type, body) = get(&dist.0, "/data/manifest.json").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(content_type.as_deref(), Some("application/json"));
        assert_eq!(body, br#"{"layers":[]}"#);
    }

    #[tokio::test]
    async fn unknown_files_are_not_found() {
        let dist = fake_dist();
        let (status, _, _) = get(&dist.0, "/data/nope.bin").await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn refuses_paths_outside_the_folder() {
        let dist = fake_dist();
        fs::write(dist.0.join("../secret.txt"), "secret").ok();
        let (status, _, body) = get(&dist.0, "/../secret.txt").await;
        assert_ne!(status, StatusCode::OK);
        assert_ne!(body, b"secret");
        let _ = fs::remove_file(dist.0.join("../secret.txt"));
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
        assert!(listen_addr(Some("localhost-ish"), None).is_err());
        assert!(listen_addr(None, Some("99999")).is_err());
    }
}
