/**
 * Extracts verbatim PDF sections from /tmp/chapter2.txt and writes
 * scripts/powers-pdf-content.js for the Powers topic generator.
 *
 * Run: node scripts/extract-powers-pdf-sections.js
 */
const fs = require('fs');
const path = require('path');

const PDF_TEXT = '/tmp/chapter2.txt';
const OUT_FILE = path.join(__dirname, 'powers-pdf-content.js');

const TEACHING_SECTION_HEADINGS = [
  '1. DETAILED EXPLANATION',
  '2. MAIN VIDEO SEARCH QUERIES',
  '3. CURIOSITY LAYER',
  '4. REAL-LIFE CONNECTIONS',
  '5. MISCONCEPTIONS',
  '6. EXPERIMENT / ACTIVITY',
  '7. QUIZ',
];

const TOPIC_META = [
  {topicId: 'introduction_to_powers', topicName: '1. Introduction to Powers', marker: 'TOPIC 1: INTRODUCTION TO POWERS'},
  {topicId: 'negative_integral_exponents', topicName: '2. Negative Integral Exponents', marker: 'TOPIC 2: NEGATIVE INTEGRAL EXPONENTS'},
  {topicId: 'decimal_exponential_form', topicName: '3. Decimal Numbers in Exponential Form', marker: 'TOPIC 3: DECIMAL NUMBERS IN EXPONENTIAL FORM'},
  {topicId: 'product_law_of_exponents', topicName: '4. Product Law of Exponents', marker: 'TOPIC 4: LAWS OF INTEGRAL EXPONENTS (PART 1)'},
  {topicId: 'quotient_law_of_exponents', topicName: '5. Quotient Law of Exponents', marker: 'TOPIC 5: QUOTIENT LAW OF EXPONENTS'},
  {topicId: 'power_of_a_power', topicName: '6. Power of a Power', marker: 'TOPIC 6: POWER OF A POWER'},
  {topicId: 'power_of_a_product', topicName: '7. Power of a Product', marker: 'TOPIC 7: POWER OF A PRODUCT'},
  {topicId: 'power_of_a_quotient', topicName: '8. Power of a Quotient', marker: 'TOPIC 8: POWER OF A QUOTIENT'},
  {topicId: 'standard_form', topicName: '9. Standard Form', marker: 'TOPIC 9: STANDARD FORM (SCIENTIFIC NOTATION)'},
  {topicId: 'comparing_standard_form', topicName: '10. Comparing Large and Small Numbers', marker: 'TOPIC 10: COMPARING VERY LARGE AND VERY SMALL NUMBERS USING STANDARD FORM'},
];

const EXERCISE_META = [
  {topicId: 'exercise_2_1', topicName: '11. Exercise 2.1', marker: 'EXERCISE 2.1', endMarker: 'EXERCISE 2.2'},
  {topicId: 'exercise_2_2', topicName: '12. Exercise 2.2', marker: 'EXERCISE 2.2', endMarker: 'EXERCISE 2.3'},
  {topicId: 'exercise_2_3', topicName: '13. Exercise 2.3', marker: 'EXERCISE 2.3', endMarker: null},
];

function normalizeLines(text) {
  return text.replace(/\r\n/g, '\n').split('\n');
}

function findLineIndex(lines, pattern, start = 0) {
  if (typeof pattern === 'string') {
    for (let i = start; i < lines.length; i++) {
      if (lines[i].trim() === pattern) return i;
    }
    return -1;
  }
  for (let i = start; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i;
  }
  return -1;
}

function sliceBlock(lines, start, end) {
  return lines.slice(start, end).join('\n').trim();
}

function extractFirstYoutubeUrl(text) {
  const m = text.match(/https:\/\/youtu\.be\/[^\s?]+|https:\/\/www\.youtube\.com\/watch\?v=[^\s&]+/);
  if (!m) return undefined;
  return m[0].replace(/\?si=.*$/, '').split('?')[0];
}

const QUIZ_PREFIX = {
  introduction_to_powers: 'intro',
  negative_integral_exponents: 'neg',
  decimal_exponential_form: 'dec',
  product_law_of_exponents: 'prod',
  quotient_law_of_exponents: 'quot',
  power_of_a_power: 'pop',
  power_of_a_product: 'poprod',
  power_of_a_quotient: 'poquot',
  standard_form: 'std',
  comparing_standard_form: 'cmp',
  exercise_2_1: 'ex2_1',
  exercise_2_2: 'ex2_2',
  exercise_2_3: 'ex2_3',
};

function parseTeachingSections(blockLines) {
  const sections = [];
  const headingIndices = [];

  for (const heading of TEACHING_SECTION_HEADINGS) {
    const idx = findLineIndex(blockLines, heading);
    if (idx >= 0) headingIndices.push({heading, idx});
  }

  headingIndices.sort((a, b) => a.idx - b.idx);

  for (let i = 0; i < headingIndices.length; i++) {
    const {heading, idx} = headingIndices[i];
    const contentStart = idx + 1;
    const contentEnd =
      i + 1 < headingIndices.length
        ? headingIndices[i + 1].idx
        : blockLines.length;
    let content = sliceBlock(blockLines, contentStart, contentEnd);
    const section = {heading, content};
    if (heading === '2. MAIN VIDEO SEARCH QUERIES') {
      const videoUrl = extractFirstYoutubeUrl(content);
      if (videoUrl) section.videoUrl = videoUrl;
    }
    sections.push(section);
  }

  return sections;
}

function parseQuizFromSection7(content, prefix) {
  const questions = [];
  const normalized = content.replace(/\f/g, '\n');
  const parts = normalized.split(/(?:^|\n)(?=Q[1-9]\n)/m);
  for (const part of parts) {
    const qMatch = part.match(/^Q([1-9])\n([\s\S]*)/);
    if (!qMatch) continue;
    const qNum = qMatch[1];
    const body = qMatch[2];
    const answerMatch = body.match(/Answer:\s*([A-D])/i);
    if (!answerMatch) continue;
    const answerLetter = answerMatch[1].toUpperCase();
    const correctIndex = answerLetter.charCodeAt(0) - 'A'.charCodeAt(0);
    const beforeAnswer = body.slice(0, body.indexOf('Answer:')).trim();
    const optionMatches = [...beforeAnswer.matchAll(/^([A-D])\.\s*(.+)$/gm)];
    const options = optionMatches.map(m => m[2].trim());
    let question = beforeAnswer
      .replace(/^([A-D])\.\s*.+$/gm, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
    question = question.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!question || options.length < 2) continue;
    questions.push({
      questionId: `${prefix}_q${qNum}`,
      type: 'mcq',
      question,
      options,
      correctIndex,
      explanation: `Answer: ${answerLetter}`,
    });
  }
  return questions.sort((a, b) => {
    const na = parseInt(a.questionId.match(/_q(\d+)$/)?.[1] || '0', 10);
    const nb = parseInt(b.questionId.match(/_q(\d+)$/)?.[1] || '0', 10);
    return na - nb;
  });
}

function parseExerciseOpenQuiz(content, prefix) {
  const questions = [];
  const normalized = content.replace(/\f/g, '\n');
  const parts = normalized.split(/(?:^|\n)(?=Q[1-9]\n)/m);
  for (const part of parts) {
    const qMatch = part.match(/^Q([1-9])\n([\s\S]*)/);
    if (!qMatch) continue;
    const qNum = qMatch[1];
    const body = qMatch[2].trim();
    const answerMatch = body.match(/Answer:\s*\n?([\s\S]*?)$/i);
    if (!answerMatch) continue;
    const question = body.slice(0, body.indexOf('Answer:')).trim().replace(/\n+/g, ' ');
    const correct = answerMatch[1].trim().replace(/\n+/g, ' ');
    if (!question || !correct) continue;
    questions.push({
      questionId: `${prefix}_q${qNum}`,
      type: 'mcq',
      question,
      options: [correct, 'Review the worked solution above', 'Check the concept used', 'Try again with the rule'],
      correctIndex: 0,
      explanation: `Answer: ${correct}`,
    });
  }
  return questions.sort((a, b) => {
    const na = parseInt(a.questionId.match(/_q(\d+)$/)?.[1] || '0', 10);
    const nb = parseInt(b.questionId.match(/_q(\d+)$/)?.[1] || '0', 10);
    return na - nb;
  });
}

function parseExerciseSections(blockLines) {
  const sections = [];
  const questionRe = /^(Question|QUESTION)\s+(\d+)\(([^)]+)\)/i;
  const quizRe = /^(QUICK QUIZ|EXTRA QUIZ)/i;

  let introContent = [];
  let i = 0;
  while (i < blockLines.length) {
    const line = blockLines[i].trim();
    if (questionRe.test(line) || quizRe.test(line)) break;
    if (line.startsWith('EXERCISE') && introContent.length === 0) {
      i++;
      continue;
    }
    introContent.push(blockLines[i]);
    i++;
  }
  if (introContent.length > 0) {
    sections.push({
      heading: blockLines[0]?.trim().startsWith('EXERCISE')
        ? blockLines[0].trim()
        : 'EXERCISE',
      content: introContent.join('\n').trim(),
    });
  }

  while (i < blockLines.length) {
    const line = blockLines[i].trim();
    if (quizRe.test(line)) {
      const heading = line;
      const start = i + 1;
      i++;
      while (i < blockLines.length) {
        const next = blockLines[i].trim();
        if (questionRe.test(next) || quizRe.test(next)) break;
        if (/^EXERCISE 2\./.test(next)) break;
        i++;
      }
      sections.push({
        heading,
        content: sliceBlock(blockLines, start, i),
      });
      continue;
    }
    if (questionRe.test(line)) {
      const heading = line;
      const start = i + 1;
      i++;
      while (i < blockLines.length) {
        const next = blockLines[i].trim();
        if (questionRe.test(next) || quizRe.test(next)) break;
        if (/^EXERCISE 2\./.test(next) && i > start + 2) break;
        i++;
      }
      sections.push({
        heading,
        content: sliceBlock(blockLines, start, i),
      });
      continue;
    }
    i++;
  }
  return sections;
}

function parseWorkedProblem(heading, content, topicId) {
  const m = heading.match(/^(?:Question|QUESTION)\s+(\d+)\(([^)]+)\)/i);
  if (!m) return null;
  const problemId = `${topicId.replace('exercise_', 'ex')}_q${m[1]}_${m[2].replace(/\s/g, '')}`;
  const questionMatch = content.match(/(?:^|\n)Question\n([\s\S]*?)(?:\nConcept|\nConcepts Used|\nSolution|\nStep 1)/i);
  const question = questionMatch
    ? questionMatch[1].trim().replace(/\n+/g, ' ')
    : heading;
  const conceptsMatch = content.match(/(?:Concept Used|Concepts Used)\n([\s\S]*?)(?:\nSolution|\nStep 1)/i);
  const conceptsUsed = conceptsMatch
    ? conceptsMatch[1]
        .split('\n')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('(') && s.length > 2)
        .slice(0, 5)
    : undefined;
  const steps = [];
  const stepRe = /(?:^|\n)(?:Step-by-Step Solution|Solution|Step (\d+))\n([\s\S]*?)(?=\n(?:Step \d+|Step-by-Step Solution|Answer|Common Mistake|Why This Works|$))/gi;
  let stepMatch;
  while ((stepMatch = stepRe.exec(content)) !== null) {
    const stepText = stepMatch[2].trim();
    if (stepText) steps.push(stepText.replace(/\n+/g, '\n'));
  }
  if (steps.length === 0) {
    const solMatch = content.match(/(?:^|\n)Solution\n([\s\S]*?)(?:\nAnswer|\nCommon Mistake|$)/i);
    if (solMatch) steps.push(solMatch[1].trim());
  }
  const answerMatch = content.match(/(?:^|\n)Answer\n([\s\S]*?)(?:\nCommon Mistake|$)/i);
  const answer = answerMatch ? answerMatch[1].trim().replace(/\n+/g, ' ') : '';
  const mistakeMatch = content.match(/(?:^|\n)Common Mistake\n([\s\S]*?)$/i);
  const commonMistake = mistakeMatch ? mistakeMatch[1].trim() : undefined;
  if (!answer || steps.length === 0) return null;
  return {
    problemId,
    question,
    conceptsUsed,
    steps,
    answer,
    commonMistake,
  };
}

function deriveLegacyFields(sections, videoUrl) {
  const explanationSec = sections.find(s => s.heading === '1. DETAILED EXPLANATION');
  const explanation = explanationSec ? explanationSec.content : sections[0]?.content || 'Content from PDF.';
  const examples = [];
  const exampleRe = /(?:^|\n)(Example(?:\s+\d+)?)\n([\s\S]*?)(?=\n(?:Example|\n[A-Z][a-z]|$))/g;
  if (explanationSec) {
    let m;
    while ((m = exampleRe.exec(explanationSec.content)) !== null) {
      examples.push(`${m[1]}\n${m[2].trim()}`);
    }
  }
  if (examples.length === 0) {
    examples.push(explanation.slice(0, Math.min(200, explanation.length)));
  }
  return {explanation, examples, videoUrl};
}

function deriveBrainstorming(curiosityContent) {
  const items = [];
  const re = /Curiosity Question (\d+)\n([\s\S]*?)(?=\nVideo Search Query|\nCuriosity Question|\n4\. REAL-LIFE|$)/g;
  let m;
  while ((m = re.exec(curiosityContent)) !== null) {
    const block = m[2].trim();
    const lines = block.split('\n');
    const question = lines[0]?.trim() || '';
    const answerIdx = lines.findIndex(l => l.trim() === 'Answer');
    const answer =
      answerIdx >= 0
        ? lines.slice(answerIdx + 1).join('\n').split('\nVideo Search Query')[0].trim()
        : block;
    const videoUrl = extractFirstYoutubeUrl(block);
    const item = {question, answer};
    if (videoUrl) item.videoUrl = videoUrl;
    if (question && answer) items.push(item);
  }
  if (items.length === 0) {
    items.push({question: 'Review', answer: curiosityContent.slice(0, 500)});
  }
  return items;
}

function deriveMisconceptions(content) {
  const items = [];
  const re = /Misconception (\d+)\n([\s\S]*?)(?=\nMisconception \d+|\n6\. EXPERIMENT|\n7\. QUIZ|$)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const block = m[2].trim();
    const wrongIdx = block.indexOf('Wrong');
    if (wrongIdx < 0) continue;
    const wrong = block.slice(0, wrongIdx).trim().replace(/\n+/g, ' ');
    const correct = block.slice(wrongIdx + 'Wrong'.length).trim().replace(/\n+/g, ' ');
    if (wrong && correct) items.push({wrong, correct});
  }
  return items.length ? items : undefined;
}

function deriveRealLife(content) {
  const items = [];
  const re = /Real Life Connection (\d+) — ([^\n]+)\n([\s\S]*?)(?=\nReal Life Connection \d+|\n5\. MISCONCEPTIONS|$)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const item = {
      title: `Real Life Connection ${m[1]} — ${m[2].trim()}`,
      description: m[3].trim(),
    };
    const videoUrl = extractFirstYoutubeUrl(m[3]);
    if (videoUrl) item.videoUrl = videoUrl;
    items.push(item);
  }
  return items.length ? items : undefined;
}

function deriveActivities(content) {
  const items = [];
  const blocks = content.split(/\n(?=[A-Z][a-zA-Z ]+ Activity\n)/);
  for (const block of blocks) {
    const titleMatch = block.match(/^([^\n]+ Activity)\n/);
    if (!titleMatch) continue;
    items.push({
      title: titleMatch[1].trim(),
      instructions: block.slice(titleMatch[0].length).trim(),
    });
  }
  if (items.length === 0 && content.trim()) {
    items.push({title: 'Activity', instructions: content.trim()});
  }
  return items.length ? items : undefined;
}

function buildTeachingTopics(lines) {
  const topics = [];
  for (let t = 0; t < TOPIC_META.length; t++) {
    const meta = TOPIC_META[t];
    const start = findLineIndex(lines, meta.marker);
    const end =
      t + 1 < TOPIC_META.length
        ? findLineIndex(lines, TOPIC_META[t + 1].marker)
        : findLineIndex(lines, 'EXERCISE 2.1');
    if (start < 0) throw new Error(`Marker not found: ${meta.marker}`);
    const blockLines = lines.slice(start + 1, end > start ? end : lines.length);
    const sections = parseTeachingSections(blockLines);
    const videoSec = sections.find(s => s.heading === '2. MAIN VIDEO SEARCH QUERIES');
    const videoUrl = videoSec?.videoUrl || extractFirstYoutubeUrl(blockLines.join('\n'));
    const quizSec = sections.find(s => s.heading === '7. QUIZ');
    const quizPrefix = QUIZ_PREFIX[meta.topicId] || meta.topicId;
    const quizFixed = quizSec
      ? parseQuizFromSection7(quizSec.content, quizPrefix)
      : [];

    const curiositySec = sections.find(s => s.heading === '3. CURIOSITY LAYER');
    const miscSec = sections.find(s => s.heading === '5. MISCONCEPTIONS');
    const rlSec = sections.find(s => s.heading === '4. REAL-LIFE CONNECTIONS');
    const actSec = sections.find(s => s.heading === '6. EXPERIMENT / ACTIVITY');
    const legacy = deriveLegacyFields(sections, videoUrl);

    topics.push({
      topicId: meta.topicId,
      topicName: meta.topicName,
      sections,
      ...legacy,
      videoUrl,
      brainstorming: curiositySec
        ? deriveBrainstorming(curiositySec.content)
        : [{question: 'Review', answer: 'See PDF content.'}],
      misconceptions: miscSec ? deriveMisconceptions(miscSec.content) : undefined,
      realLifeConnections: rlSec ? deriveRealLife(rlSec.content) : undefined,
      activities: actSec ? deriveActivities(actSec.content) : undefined,
      quiz: quizFixed.length >= 1 ? quizFixed : [{questionId: `${meta.topicId}_q1`, type: 'mcq', question: 'Review', options: ['A', 'B'], correctIndex: 0, explanation: 'Answer: A'}],
    });
  }
  return topics;
}

function buildExerciseTopics(lines) {
  const topics = [];
  for (let e = 0; e < EXERCISE_META.length; e++) {
    const meta = EXERCISE_META[e];
    const start = findLineIndex(lines, meta.marker);
    let end = lines.length;
    if (meta.endMarker) {
      const endIdx = findLineIndex(lines, meta.endMarker, start + 1);
      if (endIdx > start) end = endIdx;
    }
    const blockLines = lines.slice(start, end);
    const sections = parseExerciseSections(blockLines);
    const workedProblems = [];
    for (const sec of sections) {
      if (/^(Question|QUESTION)\s+\d+\(/i.test(sec.heading)) {
        const wp = parseWorkedProblem(sec.heading, sec.content, meta.topicId);
        if (wp) workedProblems.push(wp);
      }
    }
    const introSec = sections[0];
    const explanation = introSec ? introSec.content : 'Exercise content from PDF.';
    const quizSections = sections.filter(s => /^(QUICK QUIZ|EXTRA QUIZ)/i.test(s.heading));
    const quizPrefix = QUIZ_PREFIX[meta.topicId] || meta.topicId;
    let quiz = [];
    for (const qs of quizSections) {
      const mcq = parseQuizFromSection7(qs.content, quizPrefix);
      if (mcq.length) quiz.push(...mcq);
      else quiz.push(...parseExerciseOpenQuiz(qs.content, quizPrefix));
    }
    if (quiz.length === 0) {
      quiz = [{questionId: `${quizPrefix}_q1`, type: 'mcq', question: 'Review exercise', options: ['A', 'B'], correctIndex: 0}];
    }
    topics.push({
      topicId: meta.topicId,
      topicName: meta.topicName,
      sections,
      explanation,
      examples: [explanation.slice(0, Math.min(150, explanation.length))],
      videoUrl: undefined,
      brainstorming: [{question: 'Review key rules', answer: explanation.slice(0, 300)}],
      workedProblems: workedProblems.length ? workedProblems : undefined,
      quiz,
    });
  }
  return topics;
}

function main() {
  const text = fs.readFileSync(PDF_TEXT, 'utf8');
  const lines = normalizeLines(text);
  const teaching = buildTeachingTopics(lines);
  const exercises = buildExerciseTopics(lines);
  const all = [...teaching, ...exercises];

  const out = `/**
 * Auto-generated verbatim PDF sections for CBSE Class 8 Math Chapter 2 — Powers.
 * Source: /home/naushad/Downloads/CHAPTER 2 class 8.pdf
 * Regenerate: node scripts/extract-powers-pdf-sections.js
 */
module.exports = ${JSON.stringify({TOPICS: all}, null, 2)};
`;
  fs.writeFileSync(OUT_FILE, out);
  console.log(`Wrote ${OUT_FILE} with ${all.length} topics`);
  for (const t of all) {
    console.log(`  ${t.topicId}: ${t.sections?.length ?? 0} sections, ${t.quiz?.length ?? 0} quiz Qs`);
  }
}

main();
