{
  stdenvNoCC,
  glib,
  extensionSrc ? ./.,
}:
stdenvNoCC.mkDerivation {
  pname = "gnome-shell-extension-inspo";
  version = "0.1.0";
  src = extensionSrc;
  nativeBuildInputs = [ glib ];
  dontBuild = true;
  installPhase = ''
    runHook preInstall
    dir=$out/share/gnome-shell/extensions/inspo@mario
    mkdir -p $dir
    cp metadata.json extension.js messages.js pomodoro.js pomodoroUi.js store.js stylesheet.css $dir/
    cp -r schemas $dir/schemas
    rm -f $dir/schemas/gschemas.compiled
    glib-compile-schemas $dir/schemas
    runHook postInstall
  '';
}
