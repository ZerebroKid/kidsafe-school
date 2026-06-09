import {
  ocrTokenToLatex,
  pdfContentToMarkdown,
} from '../pdfContentToMarkdown';

describe('ocrTokenToLatex', () => {
  it('converts glued exponent tokens', () => {
    expect(ocrTokenToLatex('28')).toBe('$2^{8}$');
    expect(ocrTokenToLatex('106')).toBe('$10^{6}$');
    expect(ocrTokenToLatex('10100')).toBe('$10^{100}$');
    expect(ocrTokenToLatex('1000')).toBe('$10^{0}$');
  });

  it('returns null for non-power tokens', () => {
    expect(ocrTokenToLatex('12')).toBeNull();
    expect(ocrTokenToLatex('hello')).toBeNull();
  });
});

describe('pdfContentToMarkdown', () => {
  it('converts standalone OCR power lines', () => {
    expect(pdfContentToMarkdown('So they invented:\n28')).toContain('$2^{8}$');
  });

  it('wraps known sub-headings as markdown h3', () => {
    const md = pdfContentToMarkdown('Why Were Powers Invented?\nSome text.');
    expect(md).toContain('### Why Were Powers Invented?');
  });

  it('converts quiz-style inline powers', () => {
    const md = pdfContentToMarkdown('What does: 34 mean?');
    expect(md).toBe('What does: $3^{4}$ mean?');
  });

  it('bolds answer labels', () => {
    const md = pdfContentToMarkdown('Answer\n1\n8');
    expect(md).toContain('**Answer**');
  });

  it('converts bullet lines', () => {
    const md = pdfContentToMarkdown('Examples:\n• 28');
    expect(md).toContain('- $2^{8}$');
  });

  it('merges standalone bullet markers with the next line', () => {
    const md = pdfContentToMarkdown(
      'Examples:\n•\n\n2¹⁰ = 1024 bytes\n\n•\n\n2²⁰ = 1 MB (approximately)',
    );
    expect(md).toContain('- $2^{10}$ = 1024 bytes');
    expect(md).toContain('- $2^{20}$ = 1 MB (approximately)');
    expect(md).not.toMatch(/^•$/m);
  });

  it('converts negative exponent lines', () => {
    expect(pdfContentToMarkdown('2-3')).toBe('$2^{-3}$');
  });

  it('converts equation lines with glued base', () => {
    expect(pdfContentToMarkdown('23 = 8')).toBe('$2^{3}$ = 8');
  });

  it('converts unicode superscripts in equations', () => {
    const md = pdfContentToMarkdown('2¹⁰ = 1024 bytes');
    expect(md).toBe('$2^{10}$ = 1024 bytes');
  });

  it('converts OCR equation lines without wrapping trailing text in math', () => {
    const md = pdfContentToMarkdown('210 = 1024 bytes');
    expect(md).toBe('$2^{10}$ = 1024 bytes');
  });

  it('reorders misconception Wrong/Correct labels to match the PDF', () => {
    const md = pdfContentToMarkdown(
      'Misconception 1\n2³ = 2×3\nWrong\n23 = 2 × 2 × 2 = 8\n\nMisconception 2\n5² = 10\nWrong\n52 = 25',
    );

    expect(md).toContain('### Misconception 1');
    expect(md).toMatch(/\*\*Wrong\*\*\n.*2.*= 2×3/s);
    expect(md).toMatch(/\*\*Correct\*\*\n.*2.*= 2 × 2 × 2 = 8/s);
    expect(md).toMatch(/\*\*Wrong\*\*\n.*5.*= 10/s);
    expect(md).toMatch(/\*\*Correct\*\*\n.*5.*= 25/s);
  });

  it('keeps explicit Correct: labels in misconception blocks', () => {
    const md = pdfContentToMarkdown(
      'Misconception 1\n23 × 24 = 212\n\nWrong.\nCorrect:\n27',
    );

    expect(md).toContain('**Wrong**');
    expect(md).toContain('**Correct**');
    expect(md).toContain('$2^{7}$');
    expect(md).not.toMatch(/\*\*Correct\*\*\n\*\*Correct\*\*/);
  });

  it('does not insert Correct before Example labels after Wrong', () => {
    const md = pdfContentToMarkdown(
      'Misconception 1\nNegative exponent means answer becomes negative.\nWrong.\nExample:\n2−2',
    );

    expect(md).toContain('**Wrong**');
    expect(md).toContain('**Example:**');
    expect(md).not.toContain('**Correct**');
  });

  describe('content spot-checks', () => {
    it('topic 1: headings and 2^8 OCR line', () => {
      const md = pdfContentToMarkdown(
        'Why Were Powers Invented?\nSo they invented:\n28',
      );
      expect(md).toContain('### Why Were Powers Invented?');
      expect(md).toContain('$2^{8}$');
    });

    it('topic 3 style: large and small power notation', () => {
      expect(pdfContentToMarkdown('106')).toBe('$10^{6}$');
      expect(pdfContentToMarkdown('2-3')).toBe('$2^{-3}$');
    });

    it('exercise 2.1: labels and negative exponent line', () => {
      const md = pdfContentToMarkdown(
        'Concept Used\nNegative Exponent Rule\nAnswer\nCommon Mistake',
      );
      expect(md).toContain('**Concept Used**');
      expect(md).toContain('**Answer**');
      expect(md).toContain('**Common Mistake**');
    });

    it('another example: 53 becomes standalone 5^3 line', () => {
      const md = pdfContentToMarkdown(
        'Another Example\n53\nmeans:\n5×5×5',
      );
      expect(md).toContain('### Another Example');
      expect(md).toContain('$5^{3}$');
    });
  });
});
