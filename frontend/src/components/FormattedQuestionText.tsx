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
        result.push({ type: "code", content: codeText, language: "text" });
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

export function FormattedQuestionText({ text }: FormattedQuestionTextProps) {
  if (!text) return null;

  const segments = parseQuestion(text);

  return (
    <div className="space-y-3">
      {segments.map((seg, idx) => {
        if (seg.type === "code") {
          return (
            <div
              key={idx}
              className="rounded-xl overflow-hidden border border-slate-700 my-2"
            >
              <div className="bg-slate-800 px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {seg.language || "code"}
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(seg.content)}
                  className="text-[10px] text-slate-400 hover:text-white transition-colors"
                >
                  Copy Code
                </button>
              </div>
              <SyntaxHighlighter
                language={seg.language || "text"}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: "12px 16px",
                  fontSize: "13px",
                  borderRadius: "0 0 12px 12px",
                  backgroundColor: "#1e1e1e",
                }}
                wrapLongLines={false}
              >
                {seg.content}
              </SyntaxHighlighter>
            </div>
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
