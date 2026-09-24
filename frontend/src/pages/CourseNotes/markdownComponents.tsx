// Markdown rendering overrides for CourseNotesPage.
// Extracted verbatim from the page. Pure function of `isDarkMode`.

interface MarkdownComponentsProps {
  isDarkMode: boolean
}

export function getMarkdownComponents({ isDarkMode }: MarkdownComponentsProps) {
  return {
    table: ({ node, ...props }: any) => (
      <div className={`overflow-x-auto my-7 rounded-2xl border shadow-sm ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <table className="min-w-full border-collapse" {...props} />
      </div>
    ),
    th: ({ node, ...props }: any) => (
      <th className={`border-b px-4 py-3 font-bold text-left text-sm ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-900'}`} {...props} />
    ),
    td: ({ node, ...props }: any) => (
      <td className={`border-b px-4 py-3 align-top text-sm ${isDarkMode ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-700'}`} {...props} />
    ),
    h1: ({ node, ...props }: any) => (
      <h1 className={`text-2xl sm:text-3xl font-black tracking-tight mt-10 mb-5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`} {...props} />
    ),
    h2: ({ node, ...props }: any) => (
      <h2 className={`text-xl sm:text-2xl font-extrabold tracking-tight mt-9 mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`} {...props} />
    ),
    h3: ({ node, ...props }: any) => (
      <h3 className={`text-lg sm:text-xl font-bold mt-7 mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`} {...props} />
    ),
    p: ({ node, ...props }: any) => (
      <p className={`leading-[1.85] mb-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`} {...props} />
    ),
    ul: ({ node, ...props }: any) => (
      <ul className={`list-disc ml-6 space-y-2 my-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`} {...props} />
    ),
    ol: ({ node, ...props }: any) => (
      <ol className={`list-decimal ml-6 space-y-2 my-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`} {...props} />
    ),
    blockquote: ({ node, ...props }: any) => (
      <blockquote className={`border-l-4 rounded-r-2xl px-5 py-4 not-italic my-6 ${isDarkMode ? 'border-indigo-500 bg-indigo-950/30 text-slate-300' : 'border-indigo-500 bg-indigo-50 text-slate-700'}`} {...props} />
    ),
    code: ({ node, className, children, ...props }: any) => (
      <code className={`rounded-md px-1.5 py-0.5 text-[0.9em] font-mono ${isDarkMode ? 'bg-slate-800 text-emerald-300 border border-slate-700' : 'bg-slate-100 text-slate-800 border border-slate-200'}`} {...props}>{children}</code>
    ),
    pre: ({ node, children, ...props }: any) => (
      <pre className={`my-5 rounded-xl overflow-x-auto p-4 ${isDarkMode ? 'bg-slate-950 border border-slate-700' : 'bg-slate-900 border border-slate-700'}`} {...props}>{children}</pre>
    ),
  }
}
