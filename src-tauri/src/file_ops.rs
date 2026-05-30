// file_ops.rs – GUI streaming progress events

use tauri::{AppHandle, Emitter};

/// Emit progress events to the frontend in [0.0, 1.0] range.
#[derive(serde::Serialize, Clone)]
pub struct ProgressPayload {
    pub progress: f64,
    pub label: String,
}

pub fn emit_progress(app: &AppHandle, event: &str, progress: f64, label: &str) {
    let _ = app.emit(
        event,
        ProgressPayload {
            progress,
            label: label.to_string(),
        },
    );
}
