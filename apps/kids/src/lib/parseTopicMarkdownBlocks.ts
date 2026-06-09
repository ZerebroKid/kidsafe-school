/**
 * Parses the small markdown subset emitted by pdfContentToMarkdown into render blocks.
 */

import {isYouTubeUrl} from './youtube';

export type TopicMarkdownBlock =
  | {type: 'heading'; text: string}
  | {type: 'boldLabel'; text: string}
  | {type: 'bullet'; text: string}
  | {type: 'paragraph'; text: string}
  | {type: 'youtube'; url: string}
  | {type: 'spacer'};

const HEADING_PREFIX = '### ';
const BOLD_LINE = /^\*\*(.+)\*\*$/;
const BULLET_PREFIX = '- ';

export function parseTopicMarkdownBlocks(markdown: string): TopicMarkdownBlock[] {
  const blocks: TopicMarkdownBlock[] = [];

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed) {
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type !== 'spacer') {
        blocks.push({type: 'spacer'});
      }
      continue;
    }

    if (trimmed.startsWith(HEADING_PREFIX)) {
      blocks.push({
        type: 'heading',
        text: trimmed.slice(HEADING_PREFIX.length),
      });
      continue;
    }

    const boldMatch = trimmed.match(BOLD_LINE);
    if (boldMatch) {
      blocks.push({type: 'boldLabel', text: boldMatch[1]});
      continue;
    }

    if (trimmed.startsWith(BULLET_PREFIX)) {
      blocks.push({
        type: 'bullet',
        text: trimmed.slice(BULLET_PREFIX.length),
      });
      continue;
    }

    if (isYouTubeUrl(trimmed)) {
      blocks.push({type: 'youtube', url: trimmed});
      continue;
    }

    if (trimmed === '•') {
      continue;
    }

    blocks.push({type: 'paragraph', text: trimmed});
  }

  return collapseSpacersBetweenBullets(blocks);
}

/** PDF OCR often puts blank lines between bullet items; skip extra vertical gaps. */
function collapseSpacersBetweenBullets(
  blocks: TopicMarkdownBlock[],
): TopicMarkdownBlock[] {
  const out: TopicMarkdownBlock[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const prev = out[out.length - 1];
    const next = blocks[i + 1];

    if (
      block.type === 'spacer' &&
      prev?.type === 'bullet' &&
      next?.type === 'bullet'
    ) {
      continue;
    }

    out.push(block);
  }

  return out;
}
