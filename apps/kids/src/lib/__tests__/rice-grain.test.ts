import {pdfContentToMarkdown} from '../pdfContentToMarkdown';
import {parseTopicMarkdownBlocks} from '../parseTopicMarkdownBlocks';

const riceSection = `Rice Grain Activity
Draw 8 chessboard squares.
Place:
Square 1 → 1 grain
Square 2 → 2 grains
Square 3 → 4 grains
Square 4 → 8 grains
Continue.
Observe how quickly powers grow.`;

describe('rice grain arrows', () => {
  it('preserves square arrow lines', () => {
    const md = pdfContentToMarkdown(riceSection);
    const blocks = parseTopicMarkdownBlocks(md);

    const square1 = blocks.find(
      b => b.type === 'paragraph' && b.text.includes('Square 1'),
    );
    expect(square1).toEqual({
      type: 'paragraph',
      text: 'Square 1 -> 1 grain',
    });
  });
});
