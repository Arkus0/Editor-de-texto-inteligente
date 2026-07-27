const { FusesPlugin } = require("@electron-forge/plugin-fuses")
const { FuseV1Options, FuseVersion } = require("@electron/fuses")

module.exports = {
  outDir: "dist-electron",
  packagerConfig: {
    asar: true,
    executableName: "EditorInteligenteIA",
    icon: "./src/app/favicon",
    ignore: [
      /^\/\.git($|\/)/,
      /^\/\.next($|\/)/,
      /^\/docs($|\/)/,
      /^\/dist-electron($|\/)/,
      /^\/public($|\/)/,
      /^\/release(?:$|[-/])/,
      /^\/renderer-out($|\/)/,
      /^\/scripts($|\/)/,
      /^\/src($|\/)/,
      /^\/tmp($|\/)/,
      /^\/out\/editor-texto-inteligente-win32-x64($|\/)/,
      /^\/out\/make($|\/)/,
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "EditorInteligenteIA",
        setupExe: "Editor-Inteligente-IA-Setup.exe",
        setupIcon: "./src/app/favicon.ico",
        noMsi: true,
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}
