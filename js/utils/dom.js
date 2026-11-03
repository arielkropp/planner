/* DOM Utilities */

export const $ = id => (typeof document !== "undefined" ? document.getElementById(id) : null);

export const esc = v => String(v).replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

export const icon = (name, cls = "") =>
  `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
