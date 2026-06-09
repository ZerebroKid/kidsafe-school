import {parseTopicMarkdownBlocks} from '../parseTopicMarkdownBlocks';

describe('parseTopicMarkdownBlocks', () => {
  it('parses headings', () => {
    const blocks = parseTopicMarkdownBlocks('### Why Were Powers Invented?');
    expect(blocks).toEqual([
      {type: 'heading', text: 'Why Were Powers Invented?'},
    ]);
  });

  it('parses bold labels', () => {
    const blocks = parseTopicMarkdownBlocks('**Answer**');
    expect(blocks).toEqual([{type: 'boldLabel', text: 'Answer'}]);
  });

  it('parses bullet items', () => {
    const blocks = parseTopicMarkdownBlocks('- $2^{8}$');
    expect(blocks).toEqual([{type: 'bullet', text: '$2^{8}$'}]);
  });

  it('parses paragraphs with inline math', () => {
    const blocks = parseTopicMarkdownBlocks('What does: $3^{4}$ mean?');
    expect(blocks).toEqual([
      {type: 'paragraph', text: 'What does: $3^{4}$ mean?'},
    ]);
  });

  it('inserts spacers between blank lines', () => {
    const blocks = parseTopicMarkdownBlocks('Line one\n\nLine two');
    expect(blocks).toEqual([
      {type: 'paragraph', text: 'Line one'},
      {type: 'spacer'},
      {type: 'paragraph', text: 'Line two'},
    ]);
  });

  it('parses mixed block types', () => {
    const md = [
      '### Important Terms',
      '',
      '**Base**',
      'The repeated number.',
      '- $2^{8}$',
    ].join('\n');

    expect(parseTopicMarkdownBlocks(md)).toEqual([
      {type: 'heading', text: 'Important Terms'},
      {type: 'spacer'},
      {type: 'boldLabel', text: 'Base'},
      {type: 'paragraph', text: 'The repeated number.'},
      {type: 'bullet', text: '$2^{8}$'},
    ]);
  });

  it('skips spacers between consecutive bullet items', () => {
    const md = ['- one', '', '- two'].join('\n');
    expect(parseTopicMarkdownBlocks(md)).toEqual([
      {type: 'bullet', text: 'one'},
      {type: 'bullet', text: 'two'},
    ]);
  });

  it('parses youtube url lines as video blocks', () => {
    const blocks = parseTopicMarkdownBlocks(
      'Video Search Query\nhttps://youtu.be/NS4vHqJIPiE?si=abc',
    );
    expect(blocks).toEqual([
      {type: 'paragraph', text: 'Video Search Query'},
      {type: 'youtube', url: 'https://youtu.be/NS4vHqJIPiE?si=abc'},
    ]);
  });
});
