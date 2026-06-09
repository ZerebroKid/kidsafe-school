import {pdfContentToMarkdown} from '../pdfContentToMarkdown';
import {parseTopicMarkdownBlocks} from '../parseTopicMarkdownBlocks';

describe('arrow and symbol normalization', () => {
  it('merges standalone arrow lines with neighbors', () => {
    const md = pdfContentToMarkdown('1 4\n→\n4 1');
    expect(md).toBe('1 4 -> 4 1');
    expect(parseTopicMarkdownBlocks(md)).toEqual([
      {type: 'paragraph', text: '1 4 -> 4 1'},
    ]);
  });

  it('merges math-letter fractions with arrows', () => {
    const md = pdfContentToMarkdown('𝑎 𝑏\n→\n𝑏 𝑎');
    expect(md).toBe('a b -> b a');
  });

  it('converts unicode inline arrows to ASCII', () => {
    expect(pdfContentToMarkdown('Day 1 → 2 people')).toBe('Day 1 -> 2 people');
    expect(pdfContentToMarkdown('Numerator ↔ Denominator')).toBe(
      'Numerator <-> Denominator',
    );
    expect(pdfContentToMarkdown('1000 → 100 → 10 → 1')).toBe(
      '1000 -> 100 -> 10 -> 1',
    );
  });

  it('fixes corrupted \\rightarrow (CR + ightarrow) from JSON escapes', () => {
    const corrupted = 'Square 1 \rightarrow 1 grain';
    expect(pdfContentToMarkdown(corrupted)).toBe('Square 1 -> 1 grain');
  });

  it('fixes literal backslash-rightarrow strings', () => {
    const corrupted = 'Square 1 \\rightarrow 1 grain';
    expect(pdfContentToMarkdown(corrupted)).toBe('Square 1 -> 1 grain');
  });

  it('fixes split square lines missing an arrow', () => {
    expect(pdfContentToMarkdown('Square 1\n1 grain')).toBe('Square 1 -> 1 grain');
  });

  it('fixes corrupted \\times sequences to multiplication sign', () => {
    const corrupted = '$2^{3}$ = 2 \times 2 \times 2 = 8';
    expect(pdfContentToMarkdown(corrupted)).toBe(
      '$2^{3}$ = 2 × 2 × 2 = 8',
    );
  });
});
