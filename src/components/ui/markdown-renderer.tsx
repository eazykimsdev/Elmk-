import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { Copy, Check, ExternalLink } from 'lucide-react';

export function cleanSqlReplace(str?: string | null): string {
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
 * Shared helper to strip all markdown formatting for plain-text surfaces
 * (directory cards, meta tags, search results, preview summaries).
 */
export function stripMarkdown(text?: string | null): string {
  if (!text) return '';
  return cleanSqlReplace(String(text))
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

/**
 * Custom remark plugin for Discord underline (__text__) and spoiler (||text||) syntax.
 */
function remarkDiscord(rawMarkdown: string) {
  return () => (tree: any) => {
    function visit(node: any) {
      if (!node || !node.children) return;
      const newChildren: any[] = [];
      for (const child of node.children) {
        // Underline check: commonmark parses __word__ as strong; if raw was __, convert to <u>
        if (child.type === 'strong' && child.position && rawMarkdown) {
          const raw = rawMarkdown.slice(child.position.start.offset, child.position.end.offset);
          if (raw.startsWith('__') && raw.endsWith('__')) {
            newChildren.push({
              type: 'underline',
              data: { hName: 'u' },
              children: child.children,
            });
            continue;
          }
        }

        // Spoiler check: ||text||
        if (child.type === 'text' && child.value && child.value.includes('||')) {
          const parts = child.value.split(/(\|\|[\s\S]*?\|\|)/g);
          for (const part of parts) {
            if (part.startsWith('||') && part.endsWith('||') && part.length >= 4) {
              newChildren.push({
                type: 'spoiler',
                data: { hName: 'span', hProperties: { className: 'discord-spoiler' } },
                children: [{ type: 'text', value: part.slice(2, -2) }],
              });
            } else if (part) {
              newChildren.push({ type: 'text', value: part });
            }
          }
        } else {
          visit(child);
          newChildren.push(child);
        }
      }
      node.children = newChildren;
    }
    visit(tree);
  };
}

/**
 * Strict rehype-sanitize schema:
 * - Completely disallow <img>, <script>, <iframe>, <object>, <embed>, <form>
 * - Disallow javascript: and data: URIs
 * - Only allow http: and https: protocols on links
 * - Allow <u> and <span> with discord-spoiler class
 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []).filter((t: string) => t !== 'img' && t !== 'image'),
    'u',
  ],
  protocols: {
    href: ['http', 'https'],
  },
  attributes: {
    ...defaultSchema.attributes,
    span: ['className'],
    code: ['className'],
    a: ['href', 'title', 'target', 'rel'],
  },
};

/**
 * Interactive Spoiler component (click to reveal)
 */
function SpoilerSpan({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setRevealed(!revealed)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setRevealed(!revealed);
        }
      }}
      title={revealed ? 'Click to hide spoiler' : 'Click to reveal spoiler'}
      className={`transition-colors duration-150 inline-block px-1.5 py-0.5 rounded cursor-pointer text-xs select-none ${
        revealed
          ? 'bg-[#19191D] text-[#E4E4E7] border border-[rgba(255,255,255,0.08)]'
          : 'bg-[#27272A] hover:bg-[#323238] text-transparent rounded-[4px]'
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Code block with hover copy button
 */
function CodeBlock({ inline, className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const codeContent = String(children).replace(/\n$/, '');

  if (inline) {
    return (
      <code
        className="font-mono text-[12px] bg-[#19191D] text-[#E4E4E7] px-1.5 py-0.5 rounded-[4px] border border-[rgba(255,255,255,0.06)]"
        {...props}
      >
        {children}
      </code>
    );
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-2.5 rounded-[8px] bg-[#0E0E11] border border-[rgba(255,255,255,0.08)] overflow-hidden">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-[6px] bg-[#19191D] hover:bg-[#27272A] text-[#A1A1AA] hover:text-[#F4F4F5] border border-[rgba(255,255,255,0.07)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer flex items-center gap-1 text-[11px]"
        title="Copy code"
      >
        {copied ? (
          <>
            <Check className="size-3 text-[var(--accent)]" />
            <span className="text-[var(--accent)]">Copied</span>
          </>
        ) : (
          <>
            <Copy className="size-3" />
            <span>Copy</span>
          </>
        )}
      </button>
      <pre className="p-3.5 overflow-x-auto text-[13px] font-mono leading-relaxed text-[#E4E4E7]">
        <code>{children}</code>
      </pre>
    </div>
  );
}

/**
 * Safe Link with target domain tooltip on hover
 */
function MarkdownLink({ href, children, ...props }: any) {
  let domain = '';
  try {
    if (href) {
      const url = new URL(href, window.location.origin);
      domain = url.hostname;
    }
  } catch {
    domain = href || '';
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      title={domain ? `Opens ${domain}` : undefined}
      className="inline-flex items-center gap-0.5 text-[#60A5FA] hover:text-[#93C5FD] underline underline-offset-2 transition-colors cursor-pointer"
      {...props}
    >
      <span>{children}</span>
      <ExternalLink className="size-3 opacity-70 ml-0.5 shrink-0" />
    </a>
  );
}

export interface MarkdownRendererProps {
  content?: string | null;
  className?: string;
}

/**
 * Discord-style Markdown Renderer
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const rawText = cleanSqlReplace(content);
  if (!rawText.trim()) return null;

  return (
    <div className={`prose-neutral max-w-none text-[13.5px] leading-relaxed text-[#D4D4D8] font-sans ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkDiscord(rawText)]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-[17px] font-semibold text-[#F4F4F5] mt-4 mb-2 border-b border-[rgba(255,255,255,0.07)] pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[15px] font-semibold text-[#F4F4F5] mt-3.5 mb-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[14px] font-semibold text-[#F4F4F5] mt-2.5 mb-1">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[#3F3F46] pl-3 py-0.5 my-2 text-[#A1A1AA] italic bg-[#141417]/30 rounded-r">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 my-2 text-[#D4D4D8] pl-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-2 text-[#D4D4D8] pl-1">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-[13px] leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-[#F4F4F5]">{children}</strong>,
          em: ({ children }) => <em className="italic text-[#E4E4E7]">{children}</em>,
          del: ({ children }) => <del className="line-through text-[#71717A]">{children}</del>,
          u: ({ children }) => <u className="underline underline-offset-2">{children}</u>,
          a: MarkdownLink,
          code: CodeBlock,
          span: ({ node, className: spanClass, children, ...props }: any) => {
            if (spanClass === 'discord-spoiler') {
              return <SpoilerSpan>{children}</SpoilerSpan>;
            }
            return <span className={spanClass} {...props}>{children}</span>;
          },
        }}
      >
        {rawText}
      </ReactMarkdown>
    </div>
  );
}

