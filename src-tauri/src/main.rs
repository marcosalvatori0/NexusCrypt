// main.rs – NexusCrypt desktop binary entry point
// Prevents extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    nexuscrypt_lib::run();
}
