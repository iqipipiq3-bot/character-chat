"use client";

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

export function MarkdownRenderer({ content, components: componentOverrides }: { content: string; components?: Components }) {
  if (!content.trim()) return null;

  return (
    <div className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: (props) => <h1 className="mb-3 mt-6 text-2xl font-bold first:mt-0">{props.children}</h1>,
          h2: (props) => <h2 className="mb-2 mt-5 text-xl font-semibold first:mt-0">{props.children}</h2>,
          h3: (props) => <h3 className="mb-2 mt-4 text-base font-semibold first:mt-0">{props.children}</h3>,
          h4: (props) => <h4 className="mb-1 mt-3 text-sm font-semibold first:mt-0">{props.children}</h4>,
          p: (props) => <p className="mb-3 last:mb-0">{props.children}</p>,
          ul: (props) => <ul className="mb-3 list-disc space-y-1 pl-5">{props.children}</ul>,
          ol: (props) => <ol className="mb-3 list-decimal space-y-1 pl-5">{props.children}</ol>,
          li: (props) => <li className="leading-relaxed">{props.children}</li>,
          blockquote: (props) => (
            <blockquote className="my-3 border-l-4 border-zinc-300 pl-4 italic text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
              {props.children}
            </blockquote>
          ),
          pre: (props) => (
            <pre className="my-3 overflow-x-auto rounded-lg bg-zinc-100 p-4 font-mono text-xs dark:bg-zinc-800">
              {props.children}
            </pre>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className);
            return isBlock ? (
              <code className={`font-mono text-xs ${className ?? ""}`}>{children}</code>
            ) : (
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
                {children}
              </code>
            );
          },
          hr: () => <hr className="my-4 border-zinc-200 dark:border-zinc-700" />,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          table: (props) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{props.children}</table>
            </div>
          ),
          th: (props) => (
            <th className="border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-left font-semibold dark:border-zinc-700 dark:bg-zinc-800">
              {props.children}
            </th>
          ),
          td: (props) => (
            <td className="border border-zinc-200 px-3 py-1.5 dark:border-zinc-700">{props.children}</td>
          ),
          ...componentOverrides,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
