//! `jukebox-server [DIST_DIR]`: serves the built Earth Jukebox interface.
//!
//! DIST_DIR defaults to `web/dist`. `JUKEBOX_HOST` (default 127.0.0.1) and
//! `JUKEBOX_PORT` (default 8080) choose where it listens. It stops cleanly on
//! Ctrl+C and, on Unix, on SIGTERM (what `docker stop` sends), so it also shuts
//! down at once when it runs as PID 1 in a container started without --init.

use std::path::PathBuf;
use std::process::ExitCode;

use jukebox_server::{app, check_dist, listen_addr, DEFAULT_DIST};

#[tokio::main]
async fn main() -> ExitCode {
    let dist = PathBuf::from(std::env::args().nth(1).unwrap_or_else(|| DEFAULT_DIST.into()));

    if let Err(err) = check_dist(&dist) {
        eprintln!("jukebox-server: {err}");
        return ExitCode::FAILURE;
    }

    let host = std::env::var("JUKEBOX_HOST").ok();
    let port = std::env::var("JUKEBOX_PORT").ok();
    let addr = match listen_addr(host.as_deref(), port.as_deref()) {
        Ok(addr) => addr,
        Err(err) => {
            eprintln!("jukebox-server: {err}");
            return ExitCode::FAILURE;
        }
    };

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => listener,
        Err(err) => {
            eprintln!(
                "jukebox-server: cannot listen on {addr}: {err}. Is another copy already \
                 running? Set JUKEBOX_PORT to use another port."
            );
            return ExitCode::FAILURE;
        }
    };
    // The address actually bound: differs from `addr` when the port is 0.
    let bound = listener.local_addr().unwrap_or(addr);

    println!("Earth Jukebox serving {} on http://{bound}", dist.display());

    if let Err(err) = axum::serve(listener, app(&dist))
        .with_graceful_shutdown(shutdown_signal())
        .await
    {
        eprintln!("jukebox-server: {err}");
        return ExitCode::FAILURE;
    }
    ExitCode::SUCCESS
}

/// Resolves on Ctrl+C or, on Unix, on SIGTERM.
async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            // Without a SIGTERM handler, fall back to Ctrl+C only.
            Err(_) => std::future::pending::<()>().await,
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    println!("jukebox-server: stopping");
}
