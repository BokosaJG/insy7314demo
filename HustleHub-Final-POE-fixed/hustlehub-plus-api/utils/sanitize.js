// utils/sanitize.js
// Strips HTML from free-text input so stored values can never carry
// <script> or other markup into a page (stored XSS).
//
// Order matters: <script>/<style> blocks are removed WITH their contents
// first (otherwise "alert(1)" would survive as plain text), then any
// remaining tags, then stray angle brackets and control characters.

const sanitizeText = (value) =>
  String(value)
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '') // script/style blocks + body
    .replace(/<[^>]*>/g, '')                              // any other complete tag
    .replace(/[<>]/g, '')                                 // stray angle brackets
    // eslint-disable-next-line no-control-regex -- stripping control characters is the purpose of this line
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // control chars / null bytes
    .trim();

module.exports = sanitizeText;
