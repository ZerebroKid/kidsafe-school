import React, {useMemo} from 'react';
import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  View,
} from 'react-native';

import {parseTopicMarkdownBlocks} from '../../../lib/parseTopicMarkdownBlocks';
import {pdfContentToMarkdown} from '../../../lib/pdfContentToMarkdown';
import {renderSimpleLatexNodes} from '../../../lib/simpleLatexDisplay';
import {colors, spacing} from '../../../theme';
import {VideoPlayer} from './VideoPlayer';

interface Props {
  children: string;
  style?: StyleProp<TextStyle>;
}

type InlineSegment = {kind: 'text'; value: string} | {kind: 'math'; value: string};

function splitInlineMath(text: string): InlineSegment[] {
  if (!text.includes('$')) {
    return [{kind: 'text', value: text}];
  }

  const segments: InlineSegment[] = [];
  const re = /\$([^$]+)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({kind: 'text', value: text.slice(lastIndex, match.index)});
    }
    segments.push({kind: 'math', value: match[1]});
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({kind: 'text', value: text.slice(lastIndex)});
  }

  return segments.length ? segments : [{kind: 'text', value: text}];
}

function renderInlineMathChildren(
  text: string,
  style: TextStyle,
  keyPrefix: string,
): React.ReactNode {
  const segments = splitInlineMath(text);

  if (segments.length === 1 && segments[0].kind === 'text') {
    return segments[0].value;
  }

  return segments.flatMap((seg, i) =>
    seg.kind === 'math'
      ? renderSimpleLatexNodes(seg.value, style, `${keyPrefix}-m-${i}`)
      : seg.value,
  );
}

function InlineMathText({
  text,
  style,
}: {
  text: string;
  style: TextStyle;
}) {
  const segments = useMemo(() => splitInlineMath(text), [text]);

  if (segments.length === 1 && segments[0].kind === 'text') {
    return <Text style={style}>{text}</Text>;
  }

  if (segments.length === 1 && segments[0].kind === 'math') {
    return (
      <Text style={style}>
        {renderSimpleLatexNodes(segments[0].value, style, 'solo')}
      </Text>
    );
  }

  return (
    <Text style={style}>
      {renderInlineMathChildren(text, style, 'inline')}
    </Text>
  );
}

export function TopicMarkdownContent({children, style}: Props) {
  const flatStyle = StyleSheet.flatten(style) ?? {};
  const fontSize = flatStyle.fontSize ?? 14;
  const lineHeight = flatStyle.lineHeight ?? 22;
  const color = flatStyle.color ?? colors.text;

  const textStyle: TextStyle = {fontSize, lineHeight, color};
  const md = useMemo(() => pdfContentToMarkdown(children), [children]);
  const blocks = useMemo(() => parseTopicMarkdownBlocks(md), [md]);

  return (
    <View style={styles.container}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <Text key={i} style={[textStyle, styles.heading]}>
                {block.text}
              </Text>
            );
          case 'boldLabel':
            return (
              <Text
                key={i}
                style={[
                  textStyle,
                  styles.boldLabel,
                  block.text === 'Wrong' && styles.wrongLabel,
                  block.text === 'Correct' && styles.correctLabel,
                ]}>
                {block.text === 'Wrong'
                  ? '✗ Wrong'
                  : block.text === 'Correct'
                    ? '✓ Correct'
                    : block.text}
              </Text>
            );
          case 'bullet':
            return (
              <Text key={i} style={[textStyle, styles.bulletLine]}>
                {'\u2022 '}
                {renderInlineMathChildren(block.text, textStyle, `b-${i}`)}
              </Text>
            );
          case 'paragraph':
            return (
              <View key={i} style={styles.paragraph}>
                <InlineMathText text={block.text} style={textStyle} />
              </View>
            );
          case 'youtube':
            return (
              <View key={i} style={styles.videoBlock}>
                <VideoPlayer url={block.url} />
              </View>
            );
          case 'spacer':
            return <View key={i} style={styles.spacer} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  boldLabel: {
    fontWeight: '700',
    marginBottom: 4,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  wrongLabel: {
    color: colors.danger,
  },
  correctLabel: {
    color: colors.primary,
  },
  paragraph: {
    marginBottom: 8,
  },
  videoBlock: {
    marginBottom: spacing.sm,
  },
  bulletLine: {
    marginBottom: 4,
  },
  spacer: {
    height: 8,
  },
});
