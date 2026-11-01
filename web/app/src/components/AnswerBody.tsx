import { Fragment } from "react";

const INLINE = /(\*\*[^*]+\*\*|“[^”]+”|"[^"\n]+")/g;

function renderInline(text: string) {
  const parts = text.split(INLINE).filter((part) => part !== "");

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (/^[“"]/.test(part)) {
      return (
        <span className="quote" key={index}>
          {part}
        </span>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function withBreaks(lines: string[]) {
  return lines.map((line, index) => (
    <Fragment key={index}>
      {index > 0 ? <br /> : null}
      {renderInline(line)}
    </Fragment>
  ));
}

export function AnswerBody({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);

  return (
    <div className="answer-body">
      {blocks.map((block, index) => {
        const lines = block.split("\n").filter((line) => line.trim() !== "");

        if (lines.length > 0 && lines.every((line) => /^\s*[-•*]\s+/.test(line))) {
          return (
            <ul key={index}>
              {lines.map((line, itemIndex) => (
                <li key={itemIndex}>
                  {renderInline(line.replace(/^\s*[-•*]\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }

        if (lines.length > 0 && lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
          return (
            <ol key={index}>
              {lines.map((line, itemIndex) => (
                <li key={itemIndex}>
                  {renderInline(line.replace(/^\s*\d+[.)]\s+/, ""))}
                </li>
              ))}
            </ol>
          );
        }

        return <p key={index}>{withBreaks(lines)}</p>;
      })}
    </div>
  );
}
