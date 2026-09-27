import { useMemo, useState, type ReactNode } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import katex from "katex";
import "katex/dist/katex.min.css";

interface FormattedQuestionTextProps {
  text: string;
}

const STRONG_CODE_START: RegExp[] = [
  /^\s*def\s+\w+\s*\(/,
  /^\s*class\s+\w+/,
  /^\s*for\s+/,
  /^\s*while\s+/,
  /^\s*if\s+/,
  /^\s*elif\s+/,
  /^\s*else\s*[:{]/,
  /^\s*return\s+/,
  /^\s*print\s*\(/,
  /^\s*#include\s*[<"]/,
  /^\s*using\s+namespace\s+/,
  /^\s*public\s+(static\s+)?(class|void|int|String)/,
  /^\s*System\.out\./,
  /^\s*import\s+\w+/,
  /^\s*let\s+\w+\s*=/,
  /^\s*const\s+\w+\s*=/,
  /^\s*var\s+\w+\s*=/,
  /^\s*function\s+\w+/,
  /^\s*public\s+/,
  /^\s*private\s+/,
  /^\s*protected\s+/,
  /^\s*printf\s*\(/,
  /^\s*scanf\s*\(/,
  /^\s*malloc\s*\(/,
  /^\s*free\s*\(/,
  /^\s*cout\s*<</,
  /^\s*cin\s*>>/,
  /^\s*int\s+\w+/,
  /^\s*float\s+\w+/,
  /^\s*double\s+\w+/,
  /^\s*String\s+\w+/,
  /^\s*\/\//,
  /^\s*\/\*/,
  // PHP / general scripting
  /^\s*\$\w+\s*=/,              // $page = ...
  /^\s*\$_GET\[/,                // $_GET[...]
  /^\s*\$_POST\[/,               // $_POST[...]
  /^\s*\$_SESSION\[/,            // $_SESSION[...]
  /^\s*<\?php/,                   // <?php
  /^\s*echo\s+/,                  // echo ...
  /^\s*foreach\s*\(/,            // foreach (...)
  /^\s*require(_once)?\s/,        // require / require_once
  /^\s*include(_once)?\s/,        // include / include_once

  // ---- CSS, HTML, JSON, Shell, SQL, YAML, markup ----
  /^\s*[.#]?[a-zA-Z][\w-]*\s*\{\s*$/,      // .parent {  /  #id {  /  body {
  /^\s*@media\s/,                    // @media ...
  /^\s*@import\s/,                   // @import ...
  /^\s*<[a-zA-Z][^>]*>\s*$/,          // <div> or <html> on its own line
  /^\s*<!DOCTYPE\s/i,                // <!DOCTYPE html>
  /^\s*\{\s*"/,                     // {"key": ... (JSON)
  /^\s*[a-zA-Z_][\w-]*:\s+\S/,      // key: value (YAML — careful)
  /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\s+/i, // SQL
  /^\s*(sudo|cd|ls|mkdir|rm|cp|mv|cat|grep|chmod|chown|apt|yum|brew)\s/, // Shell
  /^\s*#!\//,                        // shebang
  /^\s*(BEGIN|END|PROCEDURE|FUNCTION|DECLARE)\b/i, // pseudo-code

  // ---- Extended C++ patterns (exit-exam critical) ----
  // Preprocessor
  /^\s*#define\s+/,
  /^\s*#ifdef\s+/,
  /^\s*#ifndef\s+/,
  /^\s*#pragma\s+/,
  // Namespaces / using
  /^\s*namespace\s+\w+/,
  /^\s*using\s+std::/,
  // std:: library usage
  /^\s*std::/,
  // Return types and declarations (catches: void main, bool ok, char c, long n, unsigned int i, auto x, ...)
  /^\s*(void|bool|char|short|long|unsigned|signed|auto)\s+\w+/,
  /^\s*const\s+(int|float|double|char|bool|long|short|unsigned|signed|auto|string)\b/,
  /^\s*string\s+\w+\s*[=;(]/,
  /^\s*main\s*\(/,
  // Struct / access / virtual
  /^\s*struct\s+\w+/,
  /^\s*(public|private|protected)\s*:/,
  /^\s*virtual\s+/,
  // Templates & STL
  /^\s*template\s*</,
  /^\s*vector\s*</,
  // Control flow
  /^\s*switch\s*\(/,
  /^\s*case\s+(\d+|'[^']*'|"[^"]*"|[A-Z_][A-Z0-9_]*)\s*:/,
  /^\s*default\s*:/,
  /^\s*break\s*;/,
  /^\s*continue\s*;/,
  /^\s*do\s*\{/,
  // Exceptions
  /^\s*try\s*\{/,
  /^\s*catch\s*\(/,
  /^\s*throw\s+/,
  // Memory
  /^\s*new\s+\w+\s*[\(\[]/,
  /^\s*delete(\[\])?\s+\w+\s*;/,
  // C legacy IO
  /^\s*puts\s*\(/,
  /^\s*gets\s*\(/,
];

function isIndentedBlock(line: string): boolean {
  return /^\s{4,}\S/.test(line);
}

const WEAK_CODE_END: RegExp[] = [
  /:\s*$/,
  /;\s*$/,
  /[{}]\s*$/,
  /=>\s*\{?\s*$/,
];

function looksLikeCodeStart(line: string): boolean {
  if (!line.trim()) return false;
  return STRONG_CODE_START.some((re) => re.test(line));
}

function looksLikeCodeContinuation(line: string): boolean {
  if (!line.trim()) return true;
  if (isIndentedBlock(line)) return true;
  if (WEAK_CODE_END.some((re) => re.test(line))) return true;
  if (/^\s*[{}\[\](),;]+\s*$/.test(line)) return true;
  return false;
}

function detectCodeBlockEnd(lines: string[], i: number): number {
  if (!looksLikeCodeStart(lines[i])) return -1;

  let j = i + 1;
  while (j < lines.length) {
    const line = lines[j];
    if (looksLikeCodeContinuation(line) || looksLikeCodeStart(line)) {
      j++;
      continue;
    }
    break;
  }
  if (j - i < 2) return -1;
  return j;
}

function detectLanguage(code: string): string {
  // Moved PHP before SQL so $var + SELECT combo detects as PHP
  const c = code;

  // PHP — $variable, $_GET, <?php, echo, foreach, Laravel-ish
  if (/(\$\w+\s*=)|(\$_GET\[)|(\$_POST\[)|(\$_SESSION\[)|(<\?php)|(\becho\s+["\'])|(\bforeach\s*\()|(\$this->)|(\bpublic\s+function\s+\w+)/.test(c)) {
    return "php";
  }

  // SQL — strong keywords
  if (/\b(SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|FROM\s+\w+\s+WHERE)\b/i.test(c)) {
    return "sql";
  }

  // Java — public class, System.out, package, import java
  if (/(public\s+(static\s+)?(class|void|int|String|boolean))|(System\.out\.print)|(import\s+java\.)|(public\s+static\s+void\s+main)/.test(c)) {
    return "java";
  }

  // C / C++ — comprehensive coverage for exit-exam questions
  if (
    /#include\s*[<"]/.test(c) ||
    /\busing\s+namespace\s+std\b/.test(c) ||
    /\bstd::/.test(c) ||
    /\bcout\s*<</.test(c) ||
    /\bcin\s*>>/.test(c) ||
    /\b(printf|scanf|malloc|calloc|realloc|free|puts|gets)\s*\(/.test(c) ||
    /\bnullptr\b/.test(c) ||
    /\b(void|bool|char|short|long|unsigned|signed|auto)\s+main\s*\(/.test(c) ||
    /\bstruct\s+\w+\s*\{/.test(c) ||
    /\btemplate\s*</.test(c) ||
    /\b(vector|map|set|list|deque|queue|stack)\s*</.test(c) ||
    /\bnamespace\s+\w+\s*\{/.test(c) ||
    /\b(public|private|protected)\s*:/.test(c) ||
    /\bvirtual\s+\w+/.test(c) ||
    /\bdelete(\[\])?\s+\w+\s*;/.test(c) ||
    /\bnew\s+\w+\s*[\(\[]/.test(c)
  ) {
    return "cpp";
  }

  // JavaScript / TypeScript — function, const, let, arrow, console.log
  if (/(\bfunction\s+\w+\s*\()|(\bconst\s+\w+\s*=)|(\blet\s+\w+\s*=)|(\bvar\s+\w+\s*=)|(=>\s*\{)|(\bconsole\.log\s*\()|(\bdocument\.)|(\bwindow\.)/.test(c)) {
    return "javascript";
  }

  // Python — def, elif, print(, import, from, self, indented block
  if (/(^\s*def\s+\w+\s*\()/m.test(c)) {
    return "python";
  }
  if (/(^\s*class\s+\w+\s*[:(])/m.test(c)) {
    return "python";
  }
  if (/(^\s*elif\s+)/m.test(c)) {
    return "python";
  }
  if (/(^\s*print\s*\()/m.test(c)) {
    return "python";
  }
  if (/(^\s*import\s+\w+$)/m.test(c)) {
    return "python";
  }
  if (/(^\s*from\s+\w+\s+import\s+)/m.test(c)) {
    return "python";
  }
  if (/(^\s*self\.)/m.test(c)) {
    return "python";
  }
  // Python-specific structures
  if (/(\bTrue\b)|(\bFalse\b)|(\bNone\b)|(\belif\b)|(\bexcept\b)|(\blambda\b)/.test(c)) {
    return "python";
  }

  // Go — package main, func main, :=, fmt.Print
  if (/(^\s*package\s+\w+$)/m.test(c) || /(^\s*func\s+\w+\s*\()/m.test(c) || /(:=\s*)/.test(c) || /(\bfmt\.(Print|Printf|Println)\s*\()/.test(c)) {
    return "go";
  }

  // Rust — fn main, let mut, println!, use std::
  if (/(\bfn\s+\w+\s*\()/.test(c) || /(\blet\s+mut\s+)/.test(c) || /(println!\s*\()/.test(c) || /(\buse\s+std::)/.test(c)) {
    return "rust";
  }

  // C# — using System, Console.Write, public void, namespace
  if (/(\busing\s+System\b)/.test(c) || /(\bConsole\.(Write|WriteLine)\s*\()/.test(c) || /(\bnamespace\s+\w+)/.test(c)) {
    return "csharp";
  }

  // Ruby — def / end pairs, puts, require
  if (/(^\s*def\s+\w+[\s!(])/m.test(c) && /(^\s*end\s*$)/m.test(c)) {
    return "ruby";
  }
  if (/(\bputs\s+["\'])/.test(c) || /(^\s*require\s+["\'])/m.test(c)) {
    return "ruby";
  }

  // HTML / markup — tags with attributes
  if (/(<[a-zA-Z][^>]*>)|(&lt;[a-zA-Z])|(<div\s)|(<span\s)|(<html)|(<body)/.test(c)) {
    return "html";
  }

  // CSS — selector { ... } even when multiline
  if (/(^\s*[.#]?[a-zA-Z][\w-]*\s*\{)/m.test(c) && /(:[^\n]*;)|(^\s*[.#]?[a-zA-Z][\w-]*\s*\{)/m.test(c)) {
    if (/(display|margin|padding|color|background|width|height|font-|border|position|flex|grid|gap|top|left|right|bottom|overflow|z-index)\s*:/i.test(c)) {
      return "css";
    }
    if (/(^\s*[.#]?[a-zA-Z][\w-]*\s*\{)/m.test(c) && /(^\s*\})/m.test(c)) {
      return "css";
    }
  }

  // Shell / Bash — shebang, sudo, cd, common commands
  if (/(^#!\/(usr\/)?bin\/(bash|sh|zsh))/.test(c) || /(^\s*\$\s+\w)/m.test(c) || /\b(sudo|apt-get|yum install|brew install)\b/.test(c)) {
    return "bash";
  }

  // JSON — starts with { or [ and has "key": pattern
  if (/^\s*[\[{]/.test(c) && /"\w+"\s*:/.test(c)) {
    return "json";
  }

  // YAML — key: value pairs with consistent indentation
  if (/^[a-zA-Z_][\w-]*:\s/m.test(c) && /^\s{2,}[a-zA-Z_][\w-]*:\s/m.test(c)) {
    return "yaml";
  }

  return "text";
}

interface Segment {
  type: "text" | "code";
  content: string;
  language?: string;
}

function parseQuestion(text: string): Segment[] {
  const segments: Segment[] = [];

  // Pass 1: extract explicit triple-backtick fences
  const fenceRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text)) !== null) {
    const before = text.slice(cursor, match.index);
    if (before) segments.push({ type: "text", content: before });

    segments.push({
      type: "code",
      language: match[1] || "text",
      content: match[2].replace(/\n$/, ""),
    });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ type: "text", content: text.slice(cursor) });
  }

  // Pass 2: auto-detect code blocks inside text segments
  const result: Segment[] = [];
  for (const seg of segments) {
    if (seg.type === "code") {
      result.push(seg);
      continue;
    }

    const lines = seg.content.split("\n");
    let i = 0;
    let textBuffer: string[] = [];

    const flushText = () => {
      if (textBuffer.length === 0) return;
      const joined = textBuffer.join("\n").trim();
      if (joined) result.push({ type: "text", content: joined });
      textBuffer = [];
    };

    while (i < lines.length) {
      const end = detectCodeBlockEnd(lines, i);
      if (end > 0) {
        flushText();
        const codeText = lines.slice(i, end).join("\n");
        result.push({ type: "code", content: codeText, language: detectLanguage(codeText) });
        i = end;
      } else {
        textBuffer.push(lines[i]);
        i++;
      }
    }
    flushText();
  }

  return result;
}

interface CodeBlockProps {
  content: string;
  language: string;
}

/**
 * Code block with:
 *  - fixed line-number gutter (does not scroll horizontally)
 *  - horizontally scrollable code area (long lines no longer clipped)
 *  - aligned line heights (20px) between gutter and code
 */
function CodeBlock({ content, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable — fail silently
    }
  };

  const lineCount = content.split("\n").length;
  const LINE_HEIGHT = "20px";

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700 my-2">
      <div className="bg-slate-800 px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {language || "code"}
          </span>
          {lineCount > 1 && (
            <span className="text-[10px] text-slate-500">
              {lineCount} lines
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${
            copied
              ? "text-emerald-400"
              : "text-slate-400 hover:text-white"
          }`}
        >
          {copied ? "Copied!" : "Copy Code"}
        </button>
      </div>

      <div className="flex">
        {/* Fixed line-number gutter — does NOT scroll */}
        <div
          className="flex-shrink-0 w-10 bg-slate-900/80 border-r border-slate-800 select-none pt-3 pr-2 flex flex-col items-end"
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }).map((_, i) => (
            <span
              key={i}
              className="font-mono text-[11px] text-slate-600 block"
              style={{ lineHeight: LINE_HEIGHT, height: LINE_HEIGHT }}
            >
              {i + 1}
            </span>
          ))}
        </div>

        {/* Code area — scrolls horizontally on long lines */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <SyntaxHighlighter
            language={language || "text"}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: "12px 16px",
              fontSize: "13px",
              lineHeight: LINE_HEIGHT,
              borderRadius: 0,
              backgroundColor: "#1e1e1e",
            }}
            wrapLongLines={false}
          >
            {content}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a LaTeX math expression via KaTeX.
 * Falls back to raw text if KaTeX throws.
 */
function MathNode({ expr, display }: { expr: string; display: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(expr, {
        throwOnError: false,
        displayMode: display,
      });
    } catch {
      return null;
    }
  }, [expr, display]);

  if (html === null) {
    return (
      <span className="font-mono text-slate-400">
        {display ? `$$${expr}$$` : `$${expr}$`}
      </span>
    );
  }

  if (display) {
    return (
      <div
        className="my-2 overflow-x-auto text-center"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Parses inline tokens within a single line/paragraph.
 * Priority (first match wins at each position):
 *   1. $$...$$   display math
 *   2. $...$     inline math
 *   3. `...`     inline code
 *   4. **...**   bold
 *   5. *...*     italic (word-boundary anchored)
 *   6. _..._     italic (word-boundary anchored)
 */
function renderInlineNodes(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex =
    /\$\$([\s\S]+?)\$\$|\$([^\$\n]+?)\$|`([^`\n]+?)`|(?<=^|\s)\*\*([^*\n]+?)\*\*(?=\s|$|[.,;:!?])|(?<=^|\s)\*([^*\n]+?)\*(?=\s|$|[.,;:!?])|(?<=^|\s)_([^_\n]+?)_(?=\s|$|[.,;:!?])/g;

  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));

    if (m[1] !== undefined) {
      nodes.push(<MathNode key={`m-${key++}`} expr={m[1]} display={true} />);
    } else if (m[2] !== undefined) {
      nodes.push(<MathNode key={`m-${key++}`} expr={m[2]} display={false} />);
    } else if (m[3] !== undefined) {
      nodes.push(
        <code
          key={`c-${key++}`}
          className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-100 font-mono text-[0.85em] border border-slate-700"
        >
          {m[3]}
        </code>
      );
    } else if (m[4] !== undefined) {
      nodes.push(
        <strong key={`b-${key++}`} className="font-semibold text-white">
          {m[4]}
        </strong>
      );
    } else if (m[5] !== undefined) {
      nodes.push(
        <em key={`i-${key++}`} className="italic">
          {m[5]}
        </em>
      );
    } else if (m[6] !== undefined) {
      nodes.push(
        <em key={`i-${key++}`} className="italic">
          {m[6]}
        </em>
      );
    }
    last = m.index + m[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * Splits a text segment into block-level elements:
 *   - paragraphs (consecutive non-list, non-blank lines)
 *   - unordered lists (lines starting with "- " or "* ")
 *   - ordered lists   (lines starting with "1. ")
 * Each block runs its lines through the inline renderer.
 */
function renderRichText(text: string): ReactNode[] {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let paragraphLines: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let key = 0;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const joined = paragraphLines.join("\n");
    blocks.push(
      <div key={`p-${key++}`} className="whitespace-pre-wrap">
        {renderInlineNodes(joined)}
      </div>
    );
    paragraphLines = [];
  };

  const flushList = () => {
    if (!list) return;
    const items = list.items;
    const type = list.type;
    list = null;
    if (type === "ol") {
      blocks.push(
        <ol key={`l-${key++}`} className="list-decimal list-inside space-y-1 pl-1">
          {items.map((item, i) => (
            <li key={i}>{renderInlineNodes(item)}</li>
          ))}
        </ol>
      );
    } else {
      blocks.push(
        <ul key={`l-${key++}`} className="list-disc list-inside space-y-1 pl-1">
          {items.map((item, i) => (
            <li key={i}>{renderInlineNodes(item)}</li>
          ))}
        </ul>
      );
    }
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const olMatch = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (olMatch) {
      flushParagraph();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(olMatch[1]);
      continue;
    }

    const ulMatch = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ulMatch) {
      flushParagraph();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(ulMatch[1]);
      continue;
    }

    if (list) flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

export function FormattedQuestionText({ text }: FormattedQuestionTextProps) {
  if (!text) return null;

  const segments = parseQuestion(text);

  return (
    <div className="space-y-3">
      {segments.map((seg, idx) => {
        if (seg.type === "code") {
          return (
            <CodeBlock
              key={idx}
              content={seg.content}
              language={seg.language || "text"}
            />
          );
        }

        return (
          <div
            key={idx}
            className="text-sm sm:text-base leading-relaxed space-y-2"
          >
            {renderRichText(seg.content)}
          </div>
        );
      })}
    </div>
  );
}