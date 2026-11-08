/**
 * Server-side Markdown Sanitizer & Plain Text Extractor
 */

export function cleanSqlReplace(str) {
  if (!str || typeof str !== 'string') return '';
  let s = str.trim();

  let iterations = 0;
  while (iterations < 5 && /^\s*replace\s*\(/i.test(s)) {
    iterations++;
    s = s.replace(/^\s*replace\s*\(\s*/i, '');
    
    // Look for matching or trailing ,'\n',char(10)) or ,\n,char(10)) or ,char(10)) or )
    s = s.replace(/,\s*(?:'[^']*'|"[^"]*"|char\(\d+\)|\\[rn]|\r?\n)\s*,\s*(?:'[^']*'|"[^"]*"|char\(\d+\)|\\[rn]|\r?\n)\s*\)*\s*$/i, '');
    s = s.replace(/,\s*(?:'[^']*'|"[^"]*"|char\(\d+\)|\\[rn]|\r?\n)\s*\)*\s*$/i, '');
    if (s.endsWith(')')) {
      s = s.slice(0, -1);
    }
    s = s.trim();
    // Unwrap quotes if string was wrapped in single or double quotes
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
      s = s.slice(1, -1);
    }
  }

  // Also clean any stray trailing SQL artifacts
  s = s.replace(/,\s*(?:'[^']*'|"[^"]*"|char\(\d+\)|\\[rn]|\r?\n)\s*,\s*(?:'[^']*'|"[^"]*"|char\(\d+\)|\\[rn]|\r?\n)\s*\)*\s*$/gi, '');
  s = s.replace(/,\s*(?:char\(\d+\)|\\[rn]|\r?\n)\s*\)*\s*$/gi, '');
  s = s.replace(/['"]?\s*,\s*char\(\d+\)\s*\)*\s*$/gi, '');
  
  // Unwrap unescaped quotes if left
  if (s.startsWith("'") && s.endsWith("'")) s = s.slice(1, -1);
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);

  // Replace literal string "\n" or "\r\n" with real newlines
  s = s.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  return s.trim();
}

/**
 * Strips dangerous HTML injection tags and malicious URI schemes
 */
export function sanitizeMarkdown(input) {
  if (!input) return '';
  return cleanSqlReplace(String(input))
    // Strip <script>...</script>
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Strip <iframe>...</iframe>
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Strip <style>...</style>
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Strip <img> tags entirely
    .replace(/<img\b[^>]*>/gi, '')
    // Strip other raw HTML tags (e.g. <object>, <embed>, <applet>, <form>, <input>)
    .replace(/<\/?(?:applet|embed|object|frameset|frame|form|input|button|svg|math)[^>]*>/gi, '')
    // Disallow javascript: and data: links in markdown [text](javascript:...)
    .replace(/\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)/gi, (match, label, url) => {
      const trimmed = (url || '').trim().toLowerCase();
      if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
        return label;
      }
      return match;
    })
    // Disallow javascript: in bare links
    .replace(/(?:javascript|data|vbscript):[^\s)]+/gi, '')
    // Normalize newlines
    .replace(/\r\n/g, '\n');
}

/**
 * Shared helper to strip all markdown formatting for plain-text surfaces
 * (directory cards, meta tags, search results, preview summaries).
 */
export function stripMarkdown(text) {
  if (!text) return '';
  return cleanSqlReplace(String(text))
    // First sanitize any raw html
    .replace(/<[^>]+>/g, '')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove spoilers
    .replace(/\|\|([\s\S]*?)\|\|/g, '$1')
    // Remove links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bold and italic combinations
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/___([^_]+)___/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove strikethrough
    .replace(/~~([^~]+)~~/g, '$1')
    // Remove headings #
    .replace(/^#{1,6}\s+/gm, '')
    // Remove blockquotes >
    .replace(/^>\s+/gm, '')
    // Remove bullet lists - / * / +
    .replace(/^[-*+]\s+/gm, '')
    // Remove numbered lists 1.
    .replace(/^\d+\.\s+/gm, '')
    // Replace newlines with space
    .replace(/\r?\n/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}
