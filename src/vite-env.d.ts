/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * ID of the public Google Drive folder holding your .riv files — the part of
   * the folder URL after `/folders/`. Leave both of these unset to fall back to
   * the local `src/rive/` folder.
   */
  readonly VITE_DRIVE_FOLDER_ID?: string
  /**
   * Google Cloud API key with the Drive API enabled. This is baked into the
   * client bundle and is therefore public — restrict it by HTTP referrer and
   * to the Drive API alone.
   */
  readonly VITE_DRIVE_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
