/**
 * One-off generator for CBSE grades 1–7 math + science curriculum bundles.
 * Run: node scripts/generate-cbse-grades-1-7.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'content');

const MATH_CHAPTERS = {
  1: {id: 'numbers_basics', no: 1, name: 'Numbers and Counting', topics: [
    {id: 'counting_to_20', name: 'Counting Objects up to 20'},
    {id: 'comparing_numbers', name: 'Comparing and Ordering Numbers'},
  ]},
  2: {id: 'addition_subtraction', no: 2, name: 'Addition and Subtraction', topics: [
    {id: 'adding_two_digit', name: 'Adding Two-Digit Numbers'},
    {id: 'subtracting_with_borrow', name: 'Subtraction with Borrowing'},
  ]},
  3: {id: 'multiplication_division', no: 3, name: 'Multiplication and Division', topics: [
    {id: 'times_tables', name: 'Times Tables up to 10'},
    {id: 'division_basics', name: 'Division as Equal Sharing'},
  ]},
  4: {id: 'fractions_decimals', no: 4, name: 'Fractions and Decimals', topics: [
    {id: 'understanding_fractions', name: 'Understanding Fractions'},
    {id: 'decimal_place_value', name: 'Decimal Place Value'},
  ]},
  5: {id: 'factors_multiples', no: 5, name: 'Factors, Multiples and LCM', topics: [
    {id: 'factors_and_multiples', name: 'Factors and Multiples'},
    {id: 'lcm_hcf', name: 'LCM and HCF'},
  ]},
  6: {id: 'integers_ratio', no: 6, name: 'Integers and Ratio', topics: [
    {id: 'intro_integers', name: 'Introduction to Integers'},
    {id: 'ratio_proportion', name: 'Ratio and Proportion'},
  ]},
  7: {id: 'algebra_basics', no: 7, name: 'Algebraic Expressions', topics: [
    {id: 'variables_expressions', name: 'Variables and Expressions'},
    {id: 'simple_equations', name: 'Simple Linear Equations'},
  ]},
};

const SCIENCE_CHAPTERS = {
  1: {id: 'our_world', no: 1, name: 'The World Around Us', topics: [
    {id: 'living_non_living', name: 'Living and Non-Living Things'},
    {id: 'plants_around_us', name: 'Plants Around Us'},
  ]},
  2: {id: 'animals_plants', no: 2, name: 'Animals and Plants', topics: [
    {id: 'animal_habitats', name: 'Animal Habitats and Adaptations'},
    {id: 'plant_parts', name: 'Parts of a Plant and Their Functions'},
  ]},
  3: {id: 'matter_motion', no: 3, name: 'Matter and Motion', topics: [
    {id: 'states_of_matter', name: 'States of Matter'},
    {id: 'types_of_motion', name: 'Types of Motion'},
  ]},
  4: {id: 'food_energy', no: 4, name: 'Food and Energy', topics: [
    {id: 'food_components', name: 'Components of Food'},
    {id: 'digestive_system', name: 'The Digestive System'},
  ]},
  5: {id: 'living_things', no: 5, name: 'Living Things and Life Processes', topics: [
    {id: 'photosynthesis', name: 'Photosynthesis in Plants'},
    {id: 'respiration', name: 'Respiration in Living Beings'},
  ]},
  6: {id: 'light_electricity', no: 6, name: 'Light and Electricity', topics: [
    {id: 'reflection_refraction', name: 'Reflection and Refraction of Light'},
    {id: 'electric_circuits', name: 'Electric Circuits and Components'},
  ]},
  7: {id: 'force_motion', no: 7, name: 'Force and Motion', topics: [
    {id: 'types_of_force', name: 'Types of Force'},
    {id: 'speed_and_motion', name: 'Speed, Distance and Time'},
  ]},
};

function topicTemplate({curriculumId, grade, subject, chapterNo, chapterName, topicId, topicName}) {
  const subjectLabel = subject === 'math' ? 'Mathematics' : 'Science';
  return {
    curriculumId,
    grade,
    subject,
    chapterNo,
    chapterName,
    topicId,
    topicName,
    explanation: `This is a CBSE Class ${grade} ${subjectLabel} topic on "${topicName}". Students learn key ideas through clear explanations, everyday examples, and practice questions aligned with the NCERT syllabus for grade ${grade}. Understanding this topic builds a strong foundation for the next chapter and higher classes.`,
    examples: [
      `Example 1: A real-life situation in Class ${grade} ${subjectLabel} where "${topicName}" applies.`,
      `Example 2: A classroom activity that helps students practise "${topicName}".`,
      `Example 3: A quick check question teachers can use to assess understanding of "${topicName}".`,
    ],
    videoUrl: `https://www.youtube.com/watch?v=cbse_${grade}_${subject}_${topicId}`,
    brainstorming: [
      {
        question: `Why is "${topicName}" important for Class ${grade} students?`,
        answer: `It connects to daily life and helps students build logical thinking and scientific curiosity expected at this grade level.`,
      },
      {
        question: `How can you tell if you have understood "${topicName}"?`,
        answer: `You can explain the idea in your own words, solve a simple problem, and connect it to something you see at home or school.`,
      },
      {
        question: `What should you revise before studying "${topicName}"?`,
        answer: `Review the previous chapter in the same subject and note any formulas, definitions, or vocabulary your teacher highlighted in class.`,
      },
    ],
    quiz: [
      {
        questionId: 'q1',
        type: 'mcq',
        question: `Which statement best describes "${topicName}"?`,
        options: [
          'It is unrelated to the Class syllabus',
          'It is a core idea in this chapter',
          'It only appears in higher grades',
          'It is optional for exams',
        ],
        correctIndex: 1,
        explanation: `"${topicName}" is a core concept in this chapter for Class ${grade} ${subjectLabel}.`,
      },
      {
        questionId: 'q2',
        type: 'mcq',
        question: `Class ${grade} students study "${topicName}" mainly to:`,
        options: [
          'Memorise unrelated facts',
          'Build understanding step by step',
          'Skip practical learning',
          'Avoid homework',
        ],
        correctIndex: 1,
        explanation: 'The goal is to build understanding that can be applied in problems and daily life.',
      },
      {
        questionId: 'q3',
        type: 'mcq',
        question: 'A good way to prepare for the quiz on this topic is to:',
        options: [
          'Read the explanation once only',
          'Practise examples and discuss doubts',
          'Ignore class notes',
          'Memorise answers without understanding',
        ],
        correctIndex: 1,
        explanation: 'Practising examples and clearing doubts leads to lasting learning.',
      },
      {
        questionId: 'q4',
        type: 'mcq',
        question: `This topic belongs to which subject?`,
        options: ['English', subjectLabel, 'Social Science', 'Computer Science'],
        correctIndex: 1,
        explanation: `This topic is part of Class ${grade} ${subjectLabel}.`,
      },
      {
        questionId: 'q5',
        type: 'mcq',
        question: 'After completing this topic, you should be able to:',
        options: [
          'Explain the main idea in your own words',
          'Avoid all practice questions',
          'Skip revision entirely',
          'Ignore teacher feedback',
        ],
        correctIndex: 0,
        explanation: 'Being able to explain the idea shows you have understood it.',
      },
    ],
    status: 'published',
    curatedBy: 'content_team',
  };
}

function writeBundle(grade, subject, chapterDef) {
  const curriculumId = `cbse_${grade}_${subject}`;
  const gradeDir = path.join(ROOT, `cbse_${grade}`);
  const bundleDir = path.join(gradeDir, curriculumId);
  const chapterDir = path.join(bundleDir, chapterDef.id);
  const topicsDir = path.join(chapterDir, 'topics');

  fs.mkdirSync(topicsDir, {recursive: true});

  fs.writeFileSync(
    path.join(bundleDir, 'curriculum.json'),
    JSON.stringify({id: curriculumId, board: 'cbse', grade, subject}, null, 2) + '\n',
  );

  fs.writeFileSync(
    path.join(chapterDir, 'chapter.json'),
    JSON.stringify(
      {chapterNo: chapterDef.no, chapterName: chapterDef.name, status: 'published'},
      null,
      2,
    ) + '\n',
  );

  for (const t of chapterDef.topics) {
    const topic = topicTemplate({
      curriculumId,
      grade,
      subject,
      chapterNo: chapterDef.no,
      chapterName: chapterDef.name,
      topicId: t.id,
      topicName: t.name,
    });
    fs.writeFileSync(
      path.join(topicsDir, `${t.id}.json`),
      JSON.stringify(topic, null, 2) + '\n',
    );
  }

  console.log(`  created ${curriculumId} (${chapterDef.topics.length} topics)`);
}

console.log('Generating CBSE grades 1–7 math + science...');
for (let grade = 1; grade <= 7; grade++) {
  writeBundle(grade, 'math', MATH_CHAPTERS[grade]);
  writeBundle(grade, 'science', SCIENCE_CHAPTERS[grade]);
}
console.log('Done.');
