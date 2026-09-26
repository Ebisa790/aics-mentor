import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

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
  const c = code;

  // SQL — strong keywords
  if (/\b(SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|FROM\s+\w+\s+WHERE)\b/i.test(c)) {
    return "sql";
  }

  // Java — public class, System.out, package, import java
  if (/(public\s+(static\s+)?(class|void|int|String|boolean))|(System\.out\.print)|(import\s+java\.)|(public\s+static\s+void\s+main)/.test(c)) {
    return "java";
  }

  // C / C++ — #include, cout, cin, std::, printf/scanf
  if (/(#include\s*[<"])|(\bcout\s*<<)|(\bcin\s*>>)|(\bstd::)|(using\s+namespace\s+std)|(\bprintf\s*\()|(\bscanf\s*\()|(\bmalloc\s*\()|(\bnullptr\b)|(\bstd::string\b)/.test(c)) {
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

  // PHP — $variable, $_GET, <?php, echo, foreach, Laravel-ish
  if (/(\$\w+\s*=)|(\$_GET\[)|(\$_POST\[)|(\$_SESSION\[)|(<\?php)|(\becho\s+["\'])|(\bforeach\s*\()|(\$this->)|(\bpublic\s+function\s+\w+)/.test(c)) {
    return "php";
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

  // CSS — selector { property: value; }
  if (/(^\s*[.#]?[a-zA-Z][\w-]*\s*\{[^}]*:[^}]*;)/m.test(c)) {
    return "css";
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

      <div className="relative">
        <div
          className="absolute left-0 top-0 bottom-0 w-10 bg-slate-900/80 border-r border-slate-800 select-none pointer-events-none flex flex-col items-end pt-3 pr-2"
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }).map((_, i) => (
            <span
              key={i}
              className="font-mono text-[11px] leading-[1.5] text-slate-600"
            >
              {i + 1}
            </span>
          ))}
        </div>

        <SyntaxHighlighter
          language={language || "text"}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: "12px 16px 12px 48px",
            fontSize: "13px",
            lineHeight: "1.5",
            borderRadius: 0,
            backgroundColor: "#1e1e1e",
          }}
          wrapLongLines={false}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
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
            className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap"
          >
            {seg.content}
          </div>
        );
      })}
    </div>
  );
}
