/**
 * Central place that decides "what kind of file is this" from its path.
 * Used by Explorer to decide how to read a file and what to hand off
 * to whatever consumes it next (Monaco editor, image preview, etc).
 */

export type FileCategory = "text" | "image" | "binary";

export interface FileTypeInfo {
          /** e.g. "ts", "png", "" (no extension) */
          extension: string;
          /** e.g. "typescript", "python", "plaintext" — matches Monaco's language ids */
          language: string;
          /** how the content should be treated/rendered */
          category: FileCategory;
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
          ts: "typescript",
          tsx: "typescript",
          js: "javascript",
          jsx: "javascript",
          mjs: "javascript",
          cjs: "javascript",
          json: "json",
          py: "python",
          java: "java",
          c: "c",
          h: "c",
          cpp: "cpp",
          hpp: "cpp",
          cs: "csharp",
          go: "go",
          rs: "rust",
          rb: "ruby",
          php: "php",
          html: "html",
          htm: "html",
          css: "css",
          scss: "scss",
          less: "less",
          md: "markdown",
          yml: "yaml",
          yaml: "yaml",
          xml: "xml",
          sh: "shell",
          bat: "bat",
          sql: "sql",
          toml: "toml",
          ini: "ini",
          dockerfile: "dockerfile",
          txt: "plaintext",
};

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"]);

// Anything else not covered here (fonts, archives, executables, etc.)
// that we should not attempt to read as UTF-8 text.
const KNOWN_BINARY_EXTENSIONS = new Set([
          "woff", "woff2", "ttf", "otf", "eot",
          "zip", "tar", "gz", "7z", "rar",
          "exe", "dll", "so", "dylib",
          "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
          "mp3", "mp4", "mov", "wav", "avi", "mkv",
          "db", "sqlite",
          "deb", "rpm", "appimage", "snap", "flatpak", "tar", "xz", "zst", "bz2", "iso", "img", "bin", "ko", "class",
]);

const LANGUAGE_BY_FILENAME: Record<string, string> = {
  'Dockerfile': 'dockerfile',
  'Containerfile': 'dockerfile',
  'Makefile': 'makefile',
  'Vagrantfile': 'ruby',
  'CMakeLists.txt': 'cmake',
  '.gitignore': 'ignore',
  '.dockerignore': 'ignore',
  '.editorconfig': 'ini',
  '.env': 'dotenv',
  '.bashrc': 'shellscript',
  '.bash_profile': 'shellscript',
  '.zshrc': 'shellscript',
  '.profile': 'shellscript',
}

export function getFileType(path: string): FileTypeInfo {
          const fileName = path.split('/').pop() ?? path;

          // Check exact filename matches first (Dockerfile, Makefile, dotfiles)
          if (LANGUAGE_BY_FILENAME[fileName]) {
            return { extension: '', language: LANGUAGE_BY_FILENAME[fileName], category: 'text' as const }
          }

          // Handle versioned .so files (e.g. libfoo.so.1.2.3)
          if (/\.so(\.\d+)*$/.test(fileName)) {
            return { extension: 'so', language: 'plaintext', category: 'binary' as const }
          }

          const dotIndex = fileName.lastIndexOf(".");

          // Handle dotfiles (".gitignore") and files with no extension as plaintext.
          const extension = dotIndex > 0 ? fileName.slice(dotIndex + 1).toLowerCase() : "";

          if (IMAGE_EXTENSIONS.has(extension)) {
                    return { extension, language: "plaintext", category: "image" };
          }

          if (KNOWN_BINARY_EXTENSIONS.has(extension)) {
                    return { extension, language: "plaintext", category: "binary" };
          }

          const language = LANGUAGE_BY_EXTENSION[extension] ?? "plaintext";
          return { extension, language, category: "text" };
}