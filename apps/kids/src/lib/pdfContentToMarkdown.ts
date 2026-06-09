/**
 * Converts verbatim PDF/OCR plain text (section.content) into markdown for
 * TopicMarkdownContent, with inline LaTeX ($...$) for math notation.
 */

const FORM_FEED = /\f/g;

const HEADING_PATTERNS: RegExp[] = [
  /^Why Were Powers Invented\?$/,
  /^Important Terms$/,
  /^Special Cases$/,
  /^Another Example$/,
  /^Why Is This Useful\?$/,
  /^What Does .+\?$/,
  /^Why Does .+\?$/,
  /^Curiosity Question \d+$/,
  /^Real Life Connection \d+ — .+$/,
  /^Misconception \d+$/,
  /^Any Number Raised to Power \d+$/,
  /^Any Non-Zero Number Raised to Power \d+$/,
  /^Exponent \(Power\)$/,
  /^Video Search Query$/,
  /^Main Video Queries$/,
  /^Paper Folding Activity$/,
  /^Rice Grain Activity$/,
  /^Why This Works$/,
  /^QUICK REVISION(?: TABLE)?$/,
  /^QUESTION \d+(?: — .+)?$/,
  /^Step-by-Step Solution$/,
];

const BOLD_LABELS = new Set([
  'Answer',
  'Wrong',
  'Correct',
  'Example:',
  'Concept Used',
  'Solution',
  'Common Mistake',
  'Step 1',
  'Step 2',
  'Step 3',
  'Base',
  'Exponent',
  'Power',
  'Verification',
  'Question',
]);

const MISCONCEPTION_HEADING = /^Misconception \d+$/;

function normalizeBoldLabel(line: string): string {
  if (line === 'Wrong.' || line === 'Wrong:') {
    return 'Wrong';
  }
  if (line === 'Correct:' || line === 'Correct.') {
    return 'Correct';
  }
  return line;
}

function isWrongOcrLabel(line: string): boolean {
  const normalized = normalizeBoldLabel(line.trim());
  return normalized === 'Wrong';
}

function isCorrectOcrLabel(line: string): boolean {
  const normalized = normalizeBoldLabel(line.trim());
  return normalized === 'Correct';
}

/** Normalize PDF OCR where exponents are glued (28 -> $2^{8}$, 106 -> $10^{6}$). */
export function ocrTokenToLatex(token: string): string | null {
  if (token === '1000') {
    return '$10^{0}$';
  }
  if (/^10\d+$/.test(token) && token.length > 2) {
    return `$10^{${token.slice(2)}}$`;
  }
  if (/^[2-9]\d+$/.test(token)) {
    return `$${token[0]}^{${token.slice(1)}}$`;
  }
  return null;
}

function normalizeUnicode(text: string): string {
  return text
    .replace(/\u2212/g, '-')
    .replace(/−/g, '-')
    .replace(/\u00D7/g, '×')
    .replace(/\times/g, '×')
    .replace(/\\times/g, '×');
}

/** LaTeX/OCR arrows and Unicode arrows → ASCII so they render on all Android fonts. */
function normalizeArrows(text: string): string {
  let s = text;

  // JSON/OCR corruption: "\rightarrow" → CR + "ightarrow", or literal "\rightarrow"
  s = s.replace(/\s*\\rightarrow\s*/g, ' -> ');
  s = s.replace(/\s*\\leftrightarrow\s*/g, ' <-> ');
  s = s.replace(/\s*\\Rightarrow\s*/g, ' => ');
  s = s.replace(/\s*\\to(?![a-zA-Z])\s*/g, ' -> ');
  s = s.replace(/\s*\rightarrow\s*/g, ' -> ');

  // Unicode arrows (may not render or may line-break on Android)
  s = s.replace(/\s*[\u2192\u2794\u27A1\u27F6]\s*/g, ' -> ');
  s = s.replace(/\s*\u2190\s*/g, ' <- ');
  s = s.replace(/\s*\u2194\s*/g, ' <-> ');
  s = s.replace(/\s*\u21D2\s*/g, ' => ');
  s = s.replace(/\s*\u21D4\s*/g, ' <=> ');

  // PDF line breaks where the arrow was dropped (e.g. Rice Grain activity)
  s = s.replace(/Square (\d+)\s*\n+\s*(\d+ grains?)/gi, 'Square $1 -> $2');
  s = s.replace(/Day (\d+)\s*\n+\s*(\d+ people)/gi, 'Day $1 -> $2');

  return s;
}

/** PDF/OCR math fonts use Unicode italic letters that Android often cannot render. */
function normalizeMathAlphanumeric(text: string): string {
  return text.replace(/[\u{1D434}-\u{1D467}]/gu, ch => {
    const code = ch.codePointAt(0)!;
    if (code >= 0x1d434 && code <= 0x1d44d) {
      return String.fromCharCode(65 + (code - 0x1d434));
    }
    if (code >= 0x1d44e && code <= 0x1d467) {
      return String.fromCharCode(97 + (code - 0x1d44e));
    }
    return ch;
  });
}

function normalizePdfText(text: string): string {
  return normalizeArrows(normalizeMathAlphanumeric(normalizeUnicode(text)));
}

const STANDALONE_ARROW = /^(→|↔|<->|->)$/;

function isHeadingLine(line: string): boolean {
  return HEADING_PATTERNS.some(re => re.test(line));
}

function isBoldLabelLine(line: string): boolean {
  return BOLD_LABELS.has(normalizeBoldLabel(line.trim()));
}

/**
 * PDF misconception blocks OCR "Wrong" between the wrong belief and the fix.
 * Reorder to: **Wrong** → wrong line, **Correct** → correct line (matching the PDF icons).
 */
function reorderMisconceptionLabels(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (MISCONCEPTION_HEADING.test(trimmed)) {
      result.push(lines[i]);
      i++;

      const blockLines: string[] = [];
      while (i < lines.length && !MISCONCEPTION_HEADING.test(lines[i].trim())) {
        blockLines.push(lines[i]);
        i++;
      }

      result.push(...reorderSingleMisconception(blockLines));
      continue;
    }

    result.push(lines[i]);
    i++;
  }

  return result;
}

function reorderSingleMisconception(blockLines: string[]): string[] {
  const out: string[] = [];
  let wrongStatementLines: string[] = [];
  let j = 0;

  const flushWrongStatement = () => {
    if (wrongStatementLines.length === 0) {
      return;
    }
    out.push('**Wrong**');
    out.push(...wrongStatementLines);
    wrongStatementLines = [];
  };

  while (j < blockLines.length) {
    const trimmed = blockLines[j].trim();

    if (isWrongOcrLabel(trimmed)) {
      flushWrongStatement();
      j++;

      let correctLabelEmitted = false;

      while (j < blockLines.length) {
        const nextTrim = blockLines[j].trim();

        if (!nextTrim) {
          out.push(blockLines[j]);
          j++;
          continue;
        }

        if (isWrongOcrLabel(nextTrim)) {
          break;
        }

        if (isCorrectOcrLabel(nextTrim)) {
          if (!correctLabelEmitted) {
            out.push('**Correct**');
            correctLabelEmitted = true;
          }
          j++;
          continue;
        }

        if (isBoldLabelLine(nextTrim) || isHeadingLine(nextTrim)) {
          out.push(...blockLines.slice(j));
          j = blockLines.length;
          break;
        }

        if (!correctLabelEmitted) {
          out.push('**Correct**');
          correctLabelEmitted = true;
        }
        out.push(blockLines[j]);
        j++;
        break;
      }
      continue;
    }

    if (isCorrectOcrLabel(trimmed)) {
      out.push('**Correct**');
      j++;
      continue;
    }

    if (trimmed) {
      wrongStatementLines.push(blockLines[j]);
    } else {
      out.push(blockLines[j]);
    }
    j++;
  }

  if (wrongStatementLines.length > 0) {
    out.push(...wrongStatementLines);
  }

  return out;
}

function convertFractionPower(text: string): string {
  return text.replace(
    /\((\d+)\/(\d+)\)\s*\^\s*\{?\s*-(\d+)\s*\}?/g,
    (_m, num, den, exp) =>
      `$\\left(\\frac{${num}}{${den}}\\right)^{-${exp}}$`,
  );
}

function convertInlineOcrPowers(text: string): string {
  let s = text;

  s = s.replace(/:\s*(\d+)(?=\s|$|[?.!])/g, (full, num: string) => {
    const latex = ocrTokenToLatex(num);
    return latex ? `: ${latex}` : full;
  });

  s = s.replace(/(\d+)(\s*=)/g, (full, num: string, eq: string) => {
    const latex = ocrTokenToLatex(num);
    return latex ? `${latex}${eq}` : full;
  });

  s = s.replace(/\b(\d+)×/g, (full, num: string) => {
    const latex = ocrTokenToLatex(num);
    return latex ? `${latex}\\times` : full;
  });

  return s;
}

const UNICODE_SUPERSCRIPT: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '-',
};

/** e.g. 2¹⁰ → $2^{10}$ so RN Text can render powers reliably. */
function convertUnicodeSuperscripts(text: string): string {
  return text.replace(/(\d)([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/g, (_m, base: string, sups: string) => {
    const exp = [...sups].map(ch => UNICODE_SUPERSCRIPT[ch] ?? ch).join('');
    return `$${base}^{${exp}}$`;
  });
}

function convertLineMath(line: string): string {
  let trimmed = line.trim();
  trimmed = convertUnicodeSuperscripts(trimmed);

  if (/^\d+$/.test(trimmed)) {
    const latex = ocrTokenToLatex(trimmed);
    if (latex) {
      return latex;
    }
  }

  const expLine = trimmed.match(/^(\d+)[-](\d+)$/);
  if (expLine) {
    return `$${expLine[1]}^{-${expLine[2]}}$`;
  }

  const eqLine = trimmed.match(/^(\d+)(\s*=.+)$/);
  if (eqLine) {
    const latex = ocrTokenToLatex(eqLine[1]);
    if (latex) {
      return `${latex}${eqLine[2]}`;
    }
  }

  let s = convertFractionPower(trimmed);
  s = convertInlineOcrPowers(s);
  return s;
}

function convertBulletLine(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed === '•' || trimmed === '•\t') {
    return null;
  }
  if (trimmed.startsWith('•')) {
    const item = trimmed.slice(1).trim();
    return item ? `- ${convertLineMath(item)}` : null;
  }
  return null;
}

/** PDF bullets are often OCR'd as `•` on one line and the item text on the next. */
function mergeStandaloneBulletLines(lines: string[]): string[] {
  const merged: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === '•' || trimmed === '•\t') {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) {
        j++;
      }
      if (j < lines.length) {
        merged.push(`• ${lines[j].trim()}`);
        i = j + 1;
        continue;
      }
    }

    merged.push(lines[i]);
    i++;
  }

  return merged;
}

/** PDF/OCR often puts → or ↔ on its own line between two expressions. */
function mergeStandaloneArrowLines(lines: string[]): string[] {
  const merged: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (STANDALONE_ARROW.test(trimmed)) {
      let prevIdx = merged.length - 1;
      while (prevIdx >= 0 && !merged[prevIdx].trim()) {
        prevIdx--;
      }

      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) {
        j++;
      }

      if (prevIdx >= 0 && j < lines.length) {
        const arrow =
          trimmed === '->' || trimmed === '→'
            ? '->'
            : trimmed === '<->' || trimmed === '↔'
              ? '<->'
              : trimmed;
        merged[prevIdx] =
          `${merged[prevIdx].trim()} ${arrow} ${lines[j].trim()}`;
        i = j + 1;
        continue;
      }
    }

    merged.push(lines[i]);
    i++;
  }

  return merged;
}

function classifyLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return '';
  }

  const bullet = convertBulletLine(line);
  if (bullet !== null) {
    return bullet;
  }

  if (isHeadingLine(trimmed)) {
    return `### ${trimmed}`;
  }

  if (isBoldLabelLine(trimmed)) {
    return `**${normalizeBoldLabel(trimmed)}**`;
  }

  return convertLineMath(trimmed);
}

/** Main entry: plain PDF section text → markdown with LaTeX math segments. */
export function pdfContentToMarkdown(raw: string): string {
  const normalized = normalizePdfText(raw).replace(FORM_FEED, '\n\n');
  const lines = reorderMisconceptionLabels(
    mergeStandaloneArrowLines(mergeStandaloneBulletLines(normalized.split('\n'))),
  );
  const out: string[] = [];

  for (const line of lines) {
    const converted = classifyLine(line);
    out.push(converted);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
