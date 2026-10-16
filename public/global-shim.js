// Polyfill for libraries that expect Node's `global`. A separate file (not an inline script) so the
// Content-Security-Policy can forbid inline scripts. Must load before the app bundle.
window.global = window;
