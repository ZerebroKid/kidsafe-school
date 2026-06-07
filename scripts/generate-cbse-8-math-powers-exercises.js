/**
 * Exercise topics (11–13) for CBSE Class 8 Math Chapter 2 — Powers.
 * Content aligned with the curated Chapter 2 PDF (Exercises 2.1–2.3).
 */
function mcq(id, question, options, correctIndex, explanation) {
  return {questionId: id, type: 'mcq', question, options, correctIndex, explanation};
}

function bs(q, a) {
  return {question: q, answer: a};
}

function wp(problemId, question, steps, answer, extra = {}) {
  return {problemId, question, steps, answer, ...extra};
}

function makeQuiz(prefix, items) {
  return items.map((item, i) =>
    mcq(`${prefix}_q${i + 1}`, item.q, item.o, item.c, item.e),
  );
}

const exercise_2_1 = {
  topicId: 'exercise_2_1',
  topicName: '11. Exercise 2.1',
  explanation:
    'Exercise 2.1 focuses on negative integral exponents. Key rules: a⁻ⁿ = 1/aⁿ; (a/b)⁻ⁿ = (b/a)ⁿ; a⁰ = 1 for a ≠ 0; a⁻¹ = 1/a. When adding fractions from negative exponents, find a common denominator. Exponents cannot be combined across addition — only across multiplication (product law) or division (quotient law).',
  examples: [
    '2⁻³ = 1/2³ = 1/8',
    '(2/3)⁻² = (3/2)² = 9/4',
    '3⁻¹ + 4⁻¹ = 1/3 + 1/4 = 7/12',
  ],
  brainstorming: [
    bs('What does a negative exponent mean?', 'It means take the reciprocal: a⁻ⁿ = 1/aⁿ. It does NOT make the answer negative.'),
    bs('Can you add exponents when adding terms like 3⁻¹ + 4⁻¹?', 'No. Convert to fractions first, then add. You cannot write 7⁻¹.'),
  ],
  workedProblems: [
    wp(
      'ex2_1_q1_i',
      'Express 2⁻³ as a rational number p/q.',
      ['Apply a⁻ⁿ = 1/aⁿ', '2⁻³ = 1/2³ = 1/8'],
      '1/8',
      {
        conceptsUsed: ['Negative Exponent Rule'],
        commonMistake: '2⁻³ = −8 — negative exponent does NOT mean negative number.',
      },
    ),
    wp(
      'ex2_1_q1_ii',
      'Evaluate (−4)⁻².',
      ['(−4)⁻² = 1/(−4)²', '(−4)² = 16', 'Answer = 1/16'],
      '1/16',
      {commonMistake: 'Writing 1/(−16) — squaring removes the sign first.'},
    ),
    wp(
      'ex2_1_q1_iii',
      'Evaluate 1/3⁻².',
      ['3⁻² = 1/9', '1/(1/9) = 9'],
      '9',
      {commonMistake: 'Stopping at 1/9 and forgetting the outer denominator.'},
    ),
    wp(
      'ex2_1_q1_iv',
      'Evaluate (1/2)⁻⁵.',
      ['Negative exponent flips fraction: (2/1)⁵', '2⁵ = 32'],
      '32',
      {commonMistake: 'Writing 1/32 — flip the fraction before applying the exponent.'},
    ),
    wp(
      'ex2_1_q1_v',
      'Evaluate (2/3)⁻².',
      ['Flip fraction: (3/2)²', '3²/2² = 9/4'],
      '9/4',
      {commonMistake: 'Writing 4/9 — remember to flip the fraction first.'},
    ),
    wp(
      'ex2_1_q2_i',
      'Find the value of 3⁻¹ + 4⁻¹.',
      ['3⁻¹ = 1/3, 4⁻¹ = 1/4', 'LCM of 3 and 4 is 12', '4/12 + 3/12 = 7/12'],
      '7/12',
      {commonMistake: '3⁻¹ + 4⁻¹ = 7⁻¹ — exponents cannot combine across addition.'},
    ),
    wp(
      'ex2_1_q2_ii',
      'Find the value of (3⁰ + 4⁻¹) × 2².',
      ['3⁰ = 1, 4⁻¹ = 1/4', '(1 + 1/4) × 4 = 5/4 × 4 = 5'],
      '5',
      {commonMistake: '3⁰ = 0 — remember a⁰ = 1 for a ≠ 0.'},
    ),
    wp(
      'ex2_1_q2_iii',
      'Find the value of (3⁻¹ + 4⁻¹ + 5⁻¹)⁰.',
      ['Sum inside bracket is non-zero', 'Any non-zero number to power 0 equals 1'],
      '1',
      {commonMistake: 'Calculating the entire LCM sum — only check the bracket is non-zero.'},
    ),
    wp(
      'ex2_1_q2_iv',
      'Find the value of [(1/3)⁻¹ − (1/4)⁻¹]⁻¹.',
      ['(1/3)⁻¹ = 3, (1/4)⁻¹ = 4', '(3 − 4)⁻¹ = (−1)⁻¹ = 1/(−1) = −1'],
      '−1',
      {commonMistake: '(−1)⁻¹ = 1 — reciprocal of −1 is still −1.'},
    ),
    wp(
      'ex2_1_q3_i',
      'Find the value of (1/2)⁻¹ + (1/3)⁻¹ + (1/4)⁻¹.',
      ['(1/2)⁻¹ = 2, (1/3)⁻¹ = 3, (1/4)⁻¹ = 4', '2 + 3 + 4 = 9'],
      '9',
    ),
    wp(
      'ex2_1_q3_ii',
      'Find the value of (1/2)⁻² + (1/3)⁻² + (1/4)⁻².',
      ['(1/2)⁻² = 2² = 4', '(1/3)⁻² = 3² = 9', '(1/4)⁻² = 4² = 16', '4 + 9 + 16 = 29'],
      '29',
    ),
    wp(
      'ex2_1_q3_iii',
      'Find the value of (2⁻¹ × 4⁻¹) ÷ 2⁻².',
      ['2⁻¹ = 1/2, 4⁻¹ = 1/4', 'Product: 1/2 × 1/4 = 1/8', '2⁻² = 1/4', '1/8 ÷ 1/4 = 1/8 × 4 = 1/2'],
      '1/2',
      {commonMistake: 'Reading ÷ as + — check the operator carefully.'},
    ),
    wp(
      'ex2_1_q3_iv',
      'Find the value of (5⁻¹ × 2⁻¹) ÷ 6⁻¹.',
      ['5⁻¹ = 1/5, 2⁻¹ = 1/2, 6⁻¹ = 1/6', '1/5 × 1/2 = 1/10', '1/10 ÷ 1/6 = 1/10 × 6 = 6/10 = 3/5'],
      '3/5',
    ),
    wp(
      'ex2_1_q4_i',
      'Simplify (4⁻¹ × 3⁻¹)².',
      ['4⁻¹ = 1/4, 3⁻¹ = 1/3', '(1/4 × 1/3)² = (1/12)² = 1/144'],
      '1/144',
      {conceptsUsed: ['Negative Exponent', 'Power of a Product']},
    ),
    wp(
      'ex2_1_q4_ii',
      'Simplify (5⁻¹ ÷ 6⁻¹)³.',
      ['5⁻¹ = 1/5, 6⁻¹ = 1/6', '1/5 ÷ 1/6 = 1/5 × 6 = 6/5', '(6/5)³ = 216/125'],
      '216/125',
    ),
    wp(
      'ex2_1_q4_iii',
      'Simplify (2⁻¹ + 3⁻¹)⁻¹.',
      ['2⁻¹ = 1/2, 3⁻¹ = 1/3', '1/2 + 1/3 = 5/6', '(5/6)⁻¹ = 6/5'],
      '6/5',
    ),
    wp(
      'ex2_1_q4_iv',
      'Simplify (3⁻¹ × 4⁻¹)⁻¹ × 5⁻¹.',
      ['3⁻¹ × 4⁻¹ = 1/12', '(1/12)⁻¹ = 12', '5⁻¹ = 1/5', '12 × 1/5 = 12/5'],
      '12/5',
    ),
    wp(
      'ex2_1_q5_i',
      'Simplify (3² + 2²) × (1/2)³.',
      ['3² = 9, 2² = 4, sum = 13', '(1/2)³ = 1/8', '13 × 1/8 = 13/8'],
      '13/8',
    ),
    wp(
      'ex2_1_q5_ii',
      'Simplify (3² − 2²) × (2/3)⁻³.',
      ['9 − 4 = 5', '(2/3)⁻³ = (3/2)³ = 27/8', '5 × 27/8 = 135/8'],
      '135/8',
    ),
    wp(
      'ex2_1_q5_iii',
      'Simplify [(1/3)⁻³ − (1/2)⁻³] ÷ (1/4)⁻³.',
      ['(1/3)⁻³ = 27, (1/2)⁻³ = 8', '27 − 8 = 19', '(1/4)⁻³ = 64', '19 ÷ 64 = 19/64'],
      '19/64',
    ),
    wp(
      'ex2_1_q5_iv',
      'Simplify (2² + 3² − 4²) ÷ (3/2)².',
      ['4 + 9 − 16 = −3', '(3/2)² = 9/4', '−3 ÷ 9/4 = −3 × 4/9 = −12/9 = −4/3'],
      '−4/3',
    ),
    wp(
      'ex2_1_q6',
      'By what number should 5⁻¹ be multiplied so that the product equals (−7)⁻¹?',
      ['5⁻¹ × x = (−7)⁻¹', '1/5 × x = −1/7', 'x = −1/7 × 5 = −5/7'],
      '−5/7',
    ),
    wp(
      'ex2_1_q7',
      'By what number should (1/2)⁻¹ be multiplied so that the product equals (−4/7)⁻¹?',
      ['2 × x = (−4/7)⁻¹ = −7/4', 'x = −7/4 ÷ 2 = −7/8'],
      '−7/8',
    ),
    wp(
      'ex2_1_q8',
      'By what number should (−15)⁻¹ be divided so that the quotient equals (−5)⁻¹?',
      ['(−1/15) ÷ x = −1/5', 'x = (−1/15) / (−1/5) = 1/15 × 5 = 1/3'],
      '1/3',
    ),
  ],
  quiz: makeQuiz('ex21', [
    {q: '5⁻² =', o: ['1/25', '−25', '25', '−1/25'], c: 0, e: '5⁻² = 1/5² = 1/25.'},
    {q: '(3/4)⁻¹ =', o: ['4/3', '3/4', '−4/3', '1/12'], c: 0, e: 'Negative exponent flips the fraction.'},
    {q: '10⁻³ =', o: ['1/1000', '1000', '−1000', '0.001 with wrong sign'], c: 0, e: '10⁻³ = 1/10³ = 1/1000.'},
    {q: '(1/5)⁻² =', o: ['25', '1/25', '5', '−25'], c: 0, e: 'Flip to 5, then square: 25.'},
    {q: '5⁻¹ + 2⁻¹ =', o: ['7/10', '7⁻¹', '3/10', '1/7'], c: 0, e: '1/5 + 1/2 = 7/10.'},
    {q: '(7⁰ + 2⁻¹) × 2 =', o: ['3', '2', '4', '1'], c: 0, e: '(1 + 1/2) × 2 = 3.'},
    {q: '(2/5)⁻¹ =', o: ['5/2', '2/5', '−5/2', '5⁻²'], c: 0, e: 'Reciprocal of 2/5 is 5/2.'},
  ]),
};

const exercise_2_2 = {
  topicId: 'exercise_2_2',
  topicName: '12. Exercise 2.2',
  explanation:
    'Exercise 2.2 applies all laws of integral exponents: product law (add exponents), quotient law (subtract), power of a power (multiply exponents), negative exponents (reciprocal), and finding unknown exponents by equating bases. When bases match on both sides, compare exponents directly.',
  examples: [
    '(3/2)⁻¹ × (3/2)⁻¹ × (3/2)⁻¹ × (3/2)⁻¹ = (3/2)⁻⁴',
    '5⁻² = 1/25',
    'If 5²ˣ ÷ 5⁻³ = 5⁵, then 2x + 3 = 5, so x = 1',
  ],
  brainstorming: [
    bs('When can you compare exponents directly?', 'When both sides have the same base: if aᵐ = aⁿ then m = n.'),
    bs('How do you convert to positive exponent?', 'Negative exponent → take reciprocal: a⁻ⁿ = 1/aⁿ or (a/b)⁻ⁿ = (b/a)ⁿ.'),
  ],
  workedProblems: [
    wp(
      'ex2_2_q1_i',
      'Write in exponential form: (3/2)⁻¹ × (3/2)⁻¹ × (3/2)⁻¹ × (3/2)⁻¹.',
      ['Same base — add exponents', '(−1) + (−1) + (−1) + (−1) = −4'],
      '(3/2)⁻⁴',
      {conceptsUsed: ['Product Law']},
    ),
    wp(
      'ex2_2_q1_ii',
      'Write in exponential form: (2/5)⁻² × (2/5)⁻² × (2/5)⁻².',
      ['Add exponents: (−2) + (−2) + (−2) = −6'],
      '(2/5)⁻⁶',
    ),
    wp('ex2_2_q2_i', 'Evaluate 5⁻².', ['5⁻² = 1/5² = 1/25'], '1/25'),
    wp('ex2_2_q2_ii', 'Evaluate (−3)⁻².', ['(−3)⁻² = 1/(−3)² = 1/9'], '1/9'),
    wp(
      'ex2_2_q2_iii',
      'Evaluate (1/3)⁻⁴.',
      ['Flip fraction: 3⁴ = 81'],
      '81',
    ),
    wp('ex2_2_q2_iv', 'Evaluate (−1/2)⁻¹.', ['Flip: −2/1'], '−2'),
    wp('ex2_2_q3_i', 'Express 6⁻¹ as p/q.', ['6⁻¹ = 1/6'], '1/6'),
    wp('ex2_2_q3_ii', 'Express (−7)⁻¹ as p/q.', ['(−7)⁻¹ = −1/7'], '−1/7'),
    wp('ex2_2_q3_iii', 'Express (1/4)⁻¹.', ['Flip: 4/1'], '4'),
    wp(
      'ex2_2_q3_iv',
      'Evaluate (−4)⁻¹ × (−3/2)⁻¹.',
      ['(−4)⁻¹ = −1/4', '(−3/2)⁻¹ = −2/3', '(−1/4) × (−2/3) = 2/12 = 1/6'],
      '1/6',
    ),
    wp(
      'ex2_2_q3_v',
      'Evaluate (3/5)⁻¹ × (5/2)⁻¹.',
      ['Flip: 5/3 × 2/5 = 10/15 = 2/3'],
      '2/3',
    ),
    wp(
      'ex2_2_q4_i',
      'Simplify (4⁻¹ × 3⁻¹)².',
      ['(1/4 × 1/3)² = (1/12)² = 1/144'],
      '1/144',
    ),
    wp(
      'ex2_2_q4_ii',
      'Simplify (5⁻¹ + 6⁻¹)³.',
      ['1/5 + 1/6 = 11/30', '(11/30)³ = 1331/27000'],
      '1331/27000',
    ),
    wp(
      'ex2_2_q4_iii',
      'Simplify (2⁻¹ + 3⁻¹)⁻¹.',
      ['1/2 + 1/3 = 5/6', '(5/6)⁻¹ = 6/5'],
      '6/5',
    ),
    wp(
      'ex2_2_q4_iv',
      'Simplify (3⁻¹ × 4⁻¹)⁻¹ × 5⁻¹.',
      ['(1/12)⁻¹ = 12', '12 × 1/5 = 12/5'],
      '12/5',
    ),
    wp(
      'ex2_2_q4_v',
      'Simplify (4⁻¹ − 5⁻¹) ÷ 3⁻¹.',
      ['1/4 − 1/5 = 1/20', '1/20 ÷ 1/3 = 1/20 × 3 = 3/20'],
      '3/20',
    ),
    wp(
      'ex2_2_q5_i',
      'Express (1/4)³ with negative exponent.',
      ['Reciprocal: 4⁻³'],
      '4⁻³',
    ),
    wp(
      'ex2_2_q5_ii',
      'Express 3⁵ with negative exponent.',
      ['(1/3)⁻⁵'],
      '(1/3)⁻⁵',
    ),
    wp(
      'ex2_2_q5_iii',
      'Express (3/5)⁴ with negative exponent.',
      ['(5/3)⁻⁴'],
      '(5/3)⁻⁴',
    ),
    wp(
      'ex2_2_q5_iv',
      'Express [(3/2)⁴]⁻³.',
      ['Power of power: (3/2)⁻¹²'],
      '(3/2)⁻¹²',
    ),
    wp(
      'ex2_2_q5_v',
      'Express [(7/3)⁴]⁻³.',
      ['(7/3)⁻¹²'],
      '(7/3)⁻¹²',
    ),
    wp(
      'ex2_2_q6_i',
      'Express (3/4)⁻² with positive exponent.',
      ['Flip: (4/3)²'],
      '(4/3)²',
    ),
    wp(
      'ex2_2_q6_ii',
      'Express (5/4)⁻³ with positive exponent.',
      ['(4/5)³'],
      '(4/5)³',
    ),
    wp(
      'ex2_2_q6_iii',
      'Express 4³ × 4⁻⁹ with positive exponent.',
      ['4³⁻⁹ = 4⁻⁶ = 1/4⁶'],
      '1/4⁶',
    ),
    wp(
      'ex2_2_q6_iv',
      'Express [(4/3)⁻³]⁻⁴.',
      ['(−3)×(−4)=12 → (4/3)¹²'],
      '(4/3)¹²',
    ),
    wp(
      'ex2_2_q6_v',
      'Express [(3/2)⁴]⁻² with positive exponent.',
      ['(3/2)⁻⁸ = (2/3)⁸'],
      '(2/3)⁸',
    ),
    wp(
      'ex2_2_q7_i',
      'Simplify [(1/3)⁻³ − (1/2)⁻³] ÷ (1/4)⁻³.',
      ['27 − 8 = 19', '19 ÷ 64 = 19/64'],
      '19/64',
    ),
    wp(
      'ex2_2_q7_ii',
      'Simplify (3² − 2²) × (2/3)⁻³.',
      ['5 × 27/8 = 135/8'],
      '135/8',
    ),
    wp(
      'ex2_2_q7_iii',
      'Simplify {(1/2)⁻¹ × (−4)⁻¹}⁻¹.',
      ['2 × (−1/4) = −1/2', '(−1/2)⁻¹ = −2'],
      '−2',
    ),
    wp(
      'ex2_2_q7_iv',
      'Simplify [(−1/4)²]⁻¹.',
      ['(1/16)⁻¹ = 16'],
      '16',
    ),
    wp(
      'ex2_2_q7_v',
      'Simplify {(2/3)²}³ × (1/3)⁻⁴ × 3⁻¹ × 6⁻¹.',
      ['(2/3)⁶ = 64/729', '(1/3)⁻⁴ = 81', '3⁻¹ = 1/3', '6⁻¹ = 1/6', '64/729 × 81 × 1/3 × 1/6 = 32/81'],
      '32/81',
    ),
    wp(
      'ex2_2_q8',
      'By what number should 5⁻¹ be multiplied so that the product equals (−7)⁻¹?',
      ['x = −5/7'],
      '−5/7',
    ),
    wp(
      'ex2_2_q9',
      'By what number should (1/2)⁻¹ be multiplied so that the product equals (−4/7)⁻¹?',
      ['x = −7/8'],
      '−7/8',
    ),
    wp(
      'ex2_2_q10',
      'By what number should (−15)⁻¹ be divided so that the quotient equals (−5)⁻¹?',
      ['x = 1/3'],
      '1/3',
    ),
    wp(
      'ex2_2_q11',
      'By what number should (5/3)⁻² be multiplied so that the product equals (7/3)⁻¹?',
      ['(3/5)² = 9/25', '9/25 × x = 3/7', 'x = 25/21'],
      '25/21',
    ),
    wp(
      'ex2_2_q12_i',
      'If (1/4)⁻⁴ × (1/4)⁻⁸ = (1/4)⁻⁴ˣ, find x.',
      ['−4 + (−8) = −12', '−12 = −4x', 'x = 3'],
      'x = 3',
      {conceptsUsed: ['Product Law', 'Equal Bases Rule']},
    ),
    wp(
      'ex2_2_q12_ii',
      'If (−1/2)⁻¹⁹ ÷ (−1/2)⁸ = (−1/2)⁻²ˣ⁺¹, find x.',
      ['−19 − 8 = −27', '−27 = −2x + 1', 'x = 14'],
      'x = 14',
    ),
    wp(
      'ex2_2_q12_iii',
      'If (3/2)⁻³ × (3/2)⁵ = (3/2)²ˣ⁺¹, find x.',
      ['−3 + 5 = 2', '2 = 2x + 1', 'x = 1/2'],
      'x = 1/2',
    ),
    wp(
      'ex2_2_q12_iv',
      'If (2/5)⁻³ × (2/5)¹⁵ = (2/5)²⁺³ˣ, find x.',
      ['12 = 2 + 3x', 'x = 10/3'],
      'x = 10/3',
    ),
    wp(
      'ex2_2_q12_v',
      'If (5/4)⁻ˣ ÷ (5/4)⁻⁴ = (5/4)⁵, find x.',
      ['−x − (−4) = 5', '−x + 4 = 5', 'x = −1'],
      'x = −1',
    ),
    wp(
      'ex2_2_q12_vi',
      'If (8/3)²ˣ⁺¹ × (8/3)⁵ = (8/3)ˣ⁺², find x.',
      ['2x + 1 + 5 = x + 2', '2x + 6 = x + 2', 'x = −4'],
      'x = −4',
    ),
    wp(
      'ex2_2_q13_i',
      'If x = (3/2)² × (2/3)⁻⁴, find x⁻².',
      ['(2/3)⁻⁴ = (3/2)⁴', 'x = (3/2)⁶', 'x⁻² = (3/2)⁻¹² = (2/3)¹²'],
      '(2/3)¹²',
    ),
    wp(
      'ex2_2_q13_ii',
      'If x = (4/5)⁻² + (1/4)², find x⁻¹.',
      ['(4/5)⁻² = 25/16', '(1/4)² = 1/16', 'x = 26/16 = 13/8', 'x⁻¹ = 8/13'],
      '8/13',
    ),
    wp(
      'ex2_2_q14',
      'Find x for which 5²ˣ ÷ 5⁻³ = 5⁵.',
      ['2x − (−3) = 5', '2x + 3 = 5', '2x = 2', 'x = 1'],
      'x = 1',
    ),
  ],
  quiz: makeQuiz('ex22', [
    {q: '5⁻² =', o: ['1/25', '25', '−25', '10'], c: 0, e: '1/5² = 1/25.'},
    {q: '(1/3)⁻⁴ =', o: ['81', '1/81', '−81', '12'], c: 0, e: 'Flip then power: 3⁴ = 81.'},
    {q: '(4⁻¹ × 3⁻¹)² =', o: ['1/144', '1/12', '1/7', '12²'], c: 0, e: '(1/12)² = 1/144.'},
    {q: '3⁵ = (1/3)⁻ⁿ when n =', o: ['5', '−5', '3', '15'], c: 0, e: '3⁵ = (1/3)⁻⁵.'},
    {q: 'If aᵐ = aⁿ then', o: ['m = n', 'm + n = 0', 'm × n = 1', 'm = −n'], c: 0, e: 'Equal bases → equal exponents.'},
    {q: '5²ˣ ÷ 5⁻³ = 5⁵ gives x =', o: ['1', '2', '4', '−1'], c: 0, e: '2x + 3 = 5 → x = 1.'},
    {q: '(2/5)⁻¹ =', o: ['5/2', '2/5', '−5/2', '25'], c: 0, e: 'Reciprocal of 2/5.'},
  ]),
};

const exercise_2_3 = {
  topicId: 'exercise_2_3',
  topicName: '13. Exercise 2.3',
  explanation:
    'Exercise 2.3 tests standard form (scientific notation): a × 10ⁿ where 1 ≤ a < 10. Large numbers: move decimal LEFT, positive exponent. Small numbers: move decimal RIGHT, negative exponent. To convert back: positive exponent → move decimal right; negative → move left.',
  examples: [
    '6020000000000 = 6.02 × 10¹²',
    '0.00000000000942 = 9.42 × 10⁻¹²',
    '4.83 × 10⁷ = 48300000',
  ],
  brainstorming: [
    bs('What makes a number standard form?', 'Coefficient between 1 and 10, times a power of 10. Example: 3.5 × 10⁵, not 35 × 10⁴.'),
    bs('Positive vs negative exponent when converting back?', 'Positive → move decimal right. Negative → move decimal left.'),
  ],
  workedProblems: [
    wp(
      'ex2_3_q1_i',
      'Express 6020000000000 in standard form.',
      ['Move decimal after first digit: 6.02', '12 places left → 10¹²'],
      '6.02 × 10¹²',
    ),
    wp(
      'ex2_3_q1_ii',
      'Express 0.00000000000942 in standard form.',
      ['First non-zero digit: 9.42', '12 places right → 10⁻¹²'],
      '9.42 × 10⁻¹²',
    ),
    wp(
      'ex2_3_q1_iii',
      'Express 0.00000000085 in standard form.',
      ['8.5 × 10⁻¹⁰'],
      '8.5 × 10⁻¹⁰',
    ),
    wp(
      'ex2_3_q1_iv',
      'Express 846 × 10⁷ in standard form.',
      ['846 = 8.46 × 10²', '8.46 × 10² × 10⁷ = 8.46 × 10⁹'],
      '8.46 × 10⁹',
    ),
    wp(
      'ex2_3_q1_v',
      'Express 3759 × 10⁻⁴ in standard form.',
      ['3759 = 3.759 × 10³', '3.759 × 10³ × 10⁻⁴ = 3.759 × 10⁻¹'],
      '3.759 × 10⁻¹',
    ),
    wp(
      'ex2_3_q1_vi',
      'Express 0.00072984 in standard form.',
      ['7.2984 × 10⁻⁴'],
      '7.2984 × 10⁻⁴',
    ),
    wp(
      'ex2_3_q1_vii',
      'Express 0.000437 × 10⁴ in standard form.',
      ['0.000437 = 4.37 × 10⁻⁴', '4.37 × 10⁻⁴ × 10⁴ = 4.37'],
      '4.37',
    ),
    wp(
      'ex2_3_q1_viii',
      'Express 4 ÷ 100000 in standard form.',
      ['0.00004 = 4 × 10⁻⁵'],
      '4 × 10⁻⁵',
    ),
    wp(
      'ex2_3_q2_i',
      'Write 4.83 × 10⁷ in usual form.',
      ['Move decimal 7 places right'],
      '48300000',
    ),
    wp(
      'ex2_3_q2_ii',
      'Write 3.02 × 10⁻⁶ in usual form.',
      ['Move decimal 6 places left'],
      '0.00000302',
    ),
    wp(
      'ex2_3_q2_iii',
      'Write 4.5 × 10⁴ in usual form.',
      ['Move decimal 4 places right'],
      '45000',
    ),
    wp(
      'ex2_3_q2_iv',
      'Write 3 × 10⁻⁸ in usual form.',
      ['Move decimal 8 places left'],
      '0.00000003',
    ),
    wp(
      'ex2_3_q2_v',
      'Write 1.0001 × 10⁹ in usual form.',
      ['Move decimal 9 places right'],
      '1000100000',
    ),
    wp(
      'ex2_3_q2_vi',
      'Write 5.8 × 10² in usual form.',
      ['Move decimal 2 places right'],
      '580',
    ),
    wp(
      'ex2_3_q2_vii',
      'Write 3.61492 × 10⁶ in usual form.',
      ['Move decimal 6 places right'],
      '3614920',
    ),
    wp(
      'ex2_3_q2_viii',
      'Write 3.25 × 10⁻⁷ in usual form.',
      ['Move decimal 7 places left'],
      '0.000000325',
    ),
  ],
  quiz: makeQuiz('ex23', [
    {q: '5000 in standard form is', o: ['5 × 10³', '50 × 10²', '500 × 10', '5 × 10⁴'], c: 0, e: '5.0 × 10³ — one non-zero digit before decimal.'},
    {q: '0.0004 in standard form is', o: ['4 × 10⁻⁴', '4 × 10⁻³', '4 × 10⁴', '40 × 10⁻⁵'], c: 0, e: '4 × 10⁻⁴.'},
    {q: 'Which is in standard form?', o: ['35 × 10⁴', '3.5 × 10⁵', '350 × 10³', '0.35 × 10⁶'], c: 1, e: '3.5 is between 1 and 10.'},
    {q: '4.83 × 10⁷ =', o: ['48300000', '4830000', '483000000', '0.48300000'], c: 0, e: 'Move decimal 7 places right.'},
    {q: '3.02 × 10⁻⁶ =', o: ['0.00000302', '0.000302', '3020000', '0.302'], c: 0, e: 'Move decimal 6 places left.'},
    {q: 'Large numbers have exponent usually', o: ['Positive', 'Negative', 'Zero', 'Fractional'], c: 0, e: 'Decimal moves left → positive exponent.'},
    {q: '6.02 × 10⁻⁵ =', o: ['0.0000602', '602000', '0.602', '60200'], c: 0, e: 'Negative exponent → move decimal left.'},
  ]),
};

module.exports = {exercise_2_1, exercise_2_2, exercise_2_3};
