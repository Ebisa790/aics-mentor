import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface FormattedQuestionTextProps {
  text: string;
}

export function FormattedQuestionText({ text }: FormattedQuestionTextProps) {
  if (!text) return null;

  // Split by code blocks (`language ... `)
  const parts = text.split(/(`[\s\S]*?`)/g);

  return (
    <div className="space-y-3">
      {parts.map((part, idx) => {
        // Check if this part is a code block
        const codeMatch = part.match(/^`(\w+)?\n([\s\S]*?)`$/);
        
        if (codeMatch) {
          const language = codeMatch[1] || 'text';
          const code = codeMatch[2];
          
          return (
            <div key={idx} className="rounded-xl overflow-hidden border border-slate-700 my-2">
              <div className="bg-slate-800 px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {language}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(code)}
                  className="text-[10px] text-slate-400 hover:text-white transition-colors"
                >
                  Copy Code
                </button>
              </div>
              <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: '12px 16px',
                  fontSize: '13px',
                  borderRadius: '0 0 12px 12px',
                  backgroundColor: '#1e1e1e',
                }}
              >
                {code}
              </SyntaxHighlighter>
            </div>
          );
        }
        
        // Regular text - render with paragraph breaks and inline code detection
        return (
          <div key={idx} className="text-sm sm:text-base leading-relaxed">
            {part.split('\n').map((line, lineIdx) => {
              if (!line.trim()) return <div key={lineIdx} className="h-2" />;
              
              // Detect inline code patterns (e.g., "int num[] = {...}" or "cout << ...")
              const inlineCodeRegex = /(int\s+\w+\s*\[?\]?\s*=|cout\s*<<|cin\s*>>|#include|using\s+namespace|return\s+\d+|for\s*\(|while\s*\(|if\s*\(|printf\s*\(|scanf\s*\(|malloc\s*\(|free\s*\(|public\s+class|public\s+static|System\.out)/;
              
              if (inlineCodeRegex.test(line)) {
                return (
                  <div key={lineIdx} className="bg-slate-900 rounded-lg px-3 py-2 my-1 font-mono text-xs text-slate-100 overflow-x-auto">
                    {line}
                  </div>
                );
              }
              
              return <p key={lineIdx}>{line}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}
