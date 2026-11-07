const STORE = "Hoodie Store";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
export { esc };

/**
 * Shared HTML shell for transactional emails. `body` and `footer` must already
 * be escaped HTML; `footer` is small print such as an unsubscribe link.
 */
export function emailLayout(
  title: string,
  body: string,
  cta?: { label: string; url: string },
  footer?: string,
) {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f6f6f7;padding:24px;color:#111">
<table role="presentation" style="max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:32px;width:100%">
<tr><td>
<p style="font-weight:900;letter-spacing:-.02em;text-transform:uppercase">${STORE}</p>
<h1 style="font-size:20px">${esc(title)}</h1>
${body}
${
  cta
    ? `<p style="margin-top:24px"><a href="${esc(cta.url)}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></p>
<p style="color:#888;font-size:12px">If the button does not work, paste this link into your browser:<br>${esc(cta.url)}</p>`
    : ""
}
${footer ? `<p style="color:#888;font-size:12px;margin-top:24px">${footer}</p>` : ""}
</td></tr></table></body></html>`;
}
