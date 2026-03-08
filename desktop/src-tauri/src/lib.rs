use tauri::{
  menu::{MenuBuilder, MenuItemBuilder, MenuEvent},
  tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
  AppHandle, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {

      let show_item = MenuItemBuilder::with_id("show", "Show").build(app)?;
      let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
      let menu = MenuBuilder::new(app)
        .items(&[&show_item, &quit_item])
        .build()?;

      let mut tray_builder = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Dissolve Chat")
        .on_menu_event(|app: &AppHandle, event: MenuEvent| match event.id().as_ref() {
          "show" => {
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.show();
              let _ = window.set_focus();
            }
          }
          "quit" => {
            app.exit(0);
          }
          _ => {}
        })
        .on_tray_icon_event(|tray: &TrayIcon, event: TrayIconEvent| {
          if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
          } = event
          {
            let app = tray.app_handle();
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.show();
              let _ = window.set_focus();
            }
          }
        });

      if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
      }

      tray_builder.build(app)?;

      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        window.hide().unwrap();
        api.prevent_close();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
