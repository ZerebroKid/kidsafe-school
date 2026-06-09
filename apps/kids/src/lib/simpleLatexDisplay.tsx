import React from 'react';
import {Text, type TextStyle} from 'react-native';

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
  '+': '⁺',
};

export type SimpleLatexPart =
  | {kind: 'text'; value: string}
  | {kind: 'power'; base: string; exp: string};

export function toSuperscript(exp: string): string {
  return exp
    .split('')
    .map(ch => SUPERSCRIPT_DIGITS[ch] ?? ch)
    .join('');
}

/**
 * Parses the small LaTeX subset emitted by pdfContentToMarkdown into text/power
 * parts that render instantly with RN Text (no async MathView).
 */
export function parseSimpleLatex(latex: string): SimpleLatexPart[] {
  const parts: SimpleLatexPart[] = [];
  let remaining = latex;

  while (remaining.length > 0) {
    const fraction = remaining.match(
      /^\\left\(\\frac\{(\d+)\}\{(\d+)\}\\right\)\^\{(-?\d+)\}/,
    );
    if (fraction) {
      parts.push({kind: 'text', value: `(${fraction[1]}/${fraction[2]})`});
      parts.push({kind: 'power', base: '', exp: fraction[3]});
      remaining = remaining.slice(fraction[0].length);
      continue;
    }

    const tenPower = remaining.match(/^10\^\{(-?\d+)\}/);
    if (tenPower) {
      parts.push({kind: 'power', base: '10', exp: tenPower[1]});
      remaining = remaining.slice(tenPower[0].length);
      continue;
    }

    const digitPower = remaining.match(/^(\d+)\^\{(-?\d+)\}/);
    if (digitPower) {
      parts.push({kind: 'power', base: digitPower[1], exp: digitPower[2]});
      remaining = remaining.slice(digitPower[0].length);
      continue;
    }

    if (remaining.startsWith('\\times')) {
      parts.push({kind: 'text', value: '×'});
      remaining = remaining.slice('\\times'.length);
      continue;
    }

    if (remaining.charCodeAt(0) === 9 && remaining.startsWith('\t' + 'imes')) {
      parts.push({kind: 'text', value: '×'});
      remaining = remaining.slice(5);
      continue;
    }

    parts.push({kind: 'text', value: remaining[0]});
    remaining = remaining.slice(1);
  }

  return mergeTextParts(parts);
}

function mergeTextParts(parts: SimpleLatexPart[]): SimpleLatexPart[] {
  const merged: SimpleLatexPart[] = [];

  for (const part of parts) {
    if (part.kind === 'text' && merged.length > 0) {
      const prev = merged[merged.length - 1];
      if (prev.kind === 'text') {
        prev.value += part.value;
        continue;
      }
    }
    merged.push(
      part.kind === 'text' ? {kind: 'text', value: part.value} : {...part},
    );
  }

  return merged;
}

/** Block layout — standalone math lines (e.g. a full `$5^{3}$` paragraph). */
export function SimpleLatexText({
  latex,
  style,
}: {
  latex: string;
  style: TextStyle;
}) {
  const parts = parseSimpleLatex(latex);

  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.kind === 'text'
          ? part.value
          : part.base === '' && part.exp
            ? toSuperscript(part.exp)
            : `${part.base}${toSuperscript(part.exp)}`,
      )}
    </Text>
  );
}

/** Inline nodes for embedding inside a parent Text (mixed prose + math). */
export function renderSimpleLatexNodes(
  latex: string,
  style: TextStyle,
  keyPrefix: string,
): React.ReactNode[] {
  return parseSimpleLatex(latex).map((part, i) => {
    const key = `${keyPrefix}-${i}`;

    if (part.kind === 'text') {
      return <Text key={key}>{part.value}</Text>;
    }

    if (part.base === '' && part.exp) {
      return <Text key={key}>{toSuperscript(part.exp)}</Text>;
    }

    return (
      <Text key={key}>
        {part.base}
        {toSuperscript(part.exp)}
      </Text>
    );
  });
}
