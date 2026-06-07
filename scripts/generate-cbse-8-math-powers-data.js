/**
 * Topic content data for CBSE Class 8 Math Chapter 2 — Powers.
 * Required by scripts/generate-cbse-8-math-powers.js
 */
const V = {
  intro: 'https://youtu.be/NS4vHqJIPiE',
  negativeExp: 'https://youtu.be/QH-QZDJctpw',
  decimalExp: 'https://youtu.be/0fKBhvDjuy0',
  productLaw: 'https://youtu.be/0Y4Er1gM2Ew',
  quotientLaw: 'https://youtu.be/A1wKTiBTsfk',
  powerPower: 'https://youtu.be/ox06qIV2c1U',
  powerProduct: 'https://youtu.be/pBQtK3CcpPY',
  powerQuotient: 'https://youtu.be/pBQtK3CcpPY',
  standardForm: 'https://youtu.be/ZtB0vJMGve4',
  comparing: 'https://youtu.be/-3dr74TKqrw',
  historyExp: 'https://youtu.be/uB4HlQW_siE',
  zeroPower: 'https://youtu.be/mYtmSx_dN_I',
  computerStorage: 'https://youtu.be/A0uhRjFS05A',
};

function mcq(id, question, options, correctIndex, explanation) {
  return {questionId: id, type: 'mcq', question, options, correctIndex, explanation};
}

function bs(q, a, videoUrl) {
  const item = {question: q, answer: a};
  if (videoUrl) item.videoUrl = videoUrl;
  return item;
}

function wp(problemId, question, steps, answer, extra = {}) {
  return {problemId, question, steps, answer, ...extra};
}

function makeQuiz7(prefix, items) {
  return items.map((item, i) => mcq(`${prefix}_q${i + 1}`, item.q, item.o, item.c, item.e));
}

const QUIZ_INTRO = makeQuiz7('intro', [
  {q: 'What does 3⁴ mean?', o: ['3×4', '3+3+3+3', '3×3×3×3', '12'], c: 2, e: '3⁴ = 3 × 3 × 3 × 3.'},
  {q: 'In 5³, the base is:', o: ['3', '5', '15', '125'], c: 1, e: 'The base is the repeated number: 5.'},
  {q: 'In 5³, the exponent is:', o: ['5', '15', '125', '3'], c: 3, e: 'The exponent is 3.'},
  {q: 'What is 2⁵?', o: ['10', '25', '32', '64'], c: 2, e: '2⁵ = 32.'},
  {q: 'What is 10³?', o: ['30', '100', '1000', '10000'], c: 2, e: '10³ = 1000.'},
  {q: 'What is 7⁰?', o: ['0', '1', '7', '70'], c: 1, e: 'Any non-zero number to power 0 equals 1.'},
  {q: 'Why do mathematicians use powers?', o: ['To make numbers longer', 'To shorten repeated multiplication', 'To avoid calculations', 'None'], c: 1, e: 'Powers are shorthand for repeated multiplication.'},
]);

const introduction_to_powers = {
  topicId: 'introduction_to_powers',
  topicName: '1. Introduction to Powers',
  explanation:
    'A power (or exponent) is a compact way to write repeated multiplication. In aⁿ, a is the base and n is the exponent — meaning a is multiplied by itself n times. Instead of writing 2 × 2 × 2 × 2 × 2 × 2 × 2 × 2, we write 2⁸. Powers are mathematical shorthand, like "kg" is shorter than "kilogram". Special cases: a¹ = a (exponent 1 changes nothing), and a⁰ = 1 for any non-zero a.',
  examples: [
    '2⁸ = 2 × 2 × 2 × 2 × 2 × 2 × 2 × 2',
    '5³ = 5 × 5 × 5 = 125',
    '10⁶ = 10 × 10 × 10 × 10 × 10 × 10 (much shorter than writing all factors)',
    '7⁴: base = 7, exponent = 4',
  ],
  videoUrl: V.intro,
  brainstorming: [
    bs('Why do we write powers at all?', 'Because numbers can become enormous. 10¹⁰⁰ would require writing 10 one hundred times — powers save time and space.', V.historyExp),
    bs('Why is 2³ called "2 cubed"?', '2³ = 8 can represent the volume of a cube with side 2. Similarly 2² represents area of a square — hence "squared".'),
    bs('Why is any number raised to power 0 equal to 1?', 'Observe: 2⁴=16, 2³=8, 2²=4, 2¹=2. Each step divides by 2, so 2⁰=1. The pattern demands it.', V.zeroPower),
  ],
  misconceptions: [
    {wrong: '2³ = 2×3 = 6', correct: '2³ = 2 × 2 × 2 = 8. Exponent means repeated multiplication, not multiplication by the exponent.'},
    {wrong: '5² = 10', correct: '5² = 25, not 5×2.'},
    {wrong: 'Bigger exponent means addition', correct: 'Exponent means repeated multiplication, not addition.'},
    {wrong: 'Power and multiplication are unrelated', correct: 'Powers are simply repeated multiplication.'},
    {wrong: 'Any number raised to power 0 equals 0', correct: '5⁰ = 1 (for any non-zero base).'},
  ],
  realLifeConnections: [
    {title: 'Computer storage', description: 'Computers use powers of 2: 2¹⁰ = 1024 bytes, 2²⁰ ≈ 1 MB, 2³⁰ ≈ 1 GB.', videoUrl: V.computerStorage},
    {title: 'Viral social media growth', description: 'One person shares with 2 friends, each shares with 2 more: Day 1→2, Day 2→4, Day 3→8 — powers in action.'},
    {title: 'Chessboard rice problem', description: 'Legend: 1 grain on first square, 2 on second, 4 on third — numbers explode rapidly through powers.'},
    {title: 'Population growth', description: 'Bacteria doubling: 1, 2, 4, 8, 16, 32… is repeated multiplication.'},
    {title: 'Compound interest', description: 'Money grows through repeated multiplication — banks and investors care about exponents.'},
  ],
  activities: [
    {title: 'Paper folding activity', instructions: 'Fold a paper 1, 2, 3, 4 times. Observe layers: 2, 4, 8, 16 — this demonstrates powers.'},
    {title: 'Rice grain activity', instructions: 'Draw 8 chessboard squares. Place 1, 2, 4, 8 grains on successive squares. Observe how quickly powers grow.'},
  ],
  quiz: QUIZ_INTRO,
};

const negative_integral_exponents = {
  topicId: 'negative_integral_exponents',
  topicName: '2. Negative Integral Exponents',
  explanation:
    'When we divide powers with the same base, nᵃ ÷ nᵇ = nᵃ⁻ᵇ. If a < b, the exponent becomes negative. A negative exponent means reciprocal: n⁻ᵃ = 1/nᵃ (n ≠ 0). For example, 2⁻⁴ = 1/2⁴ = 1/16. Similarly, 1/10³ = 10⁻³. Negative exponents do not make the number negative — they move the value to the denominator. The laws of exponents continue to work for negative and zero exponents as long as the base is not zero.',
  examples: ['2⁻³ = 1/2³ = 1/8', '10⁻² = 1/100 = 0.01', '5⁻¹ = 1/5', '10³ = 1/10⁻³'],
  videoUrl: V.negativeExp,
  brainstorming: [
    bs('What does 10⁻³ mean in words?', 'One divided by 10 three times, or 1/1000 = 0.001.'),
    bs('Is (-2)⁻³ positive or negative?', '(-2)⁻³ = 1/(-2)³ = 1/(-8) = -1/8 — negative because the base is negative and the positive exponent 3 is odd.'),
    bs('Why must the base n not be zero in n⁻ᵃ?', '0⁻ᵃ = 1/0ᵃ involves division by zero, which is undefined.'),
  ],
  misconceptions: [
    {wrong: 'A negative exponent makes the answer negative', correct: 'n⁻ᵃ = 1/nᵃ — the sign of the result depends on the base, not the negative sign in the exponent.'},
    {wrong: '2⁻³ = -8', correct: '2⁻³ = 1/2³ = 1/8, which is positive.'},
    {wrong: 'n⁻¹ means n minus 1', correct: 'n⁻¹ = 1/n — it is the reciprocal, not subtraction.'},
    {wrong: '0⁻⁵ = 0', correct: '0⁻⁵ = 1/0⁵ = 1/0, which is undefined.'},
    {wrong: 'You cannot multiply terms with negative exponents', correct: 'Laws still hold: 2⁻⁴ × 2⁷ = 2³ = 8.'},
  ],
  realLifeConnections: [
    {title: 'Microscopic measurements', description: 'Thickness of paper ≈ 10⁻⁴ m — negative powers of 10 describe very small lengths.'},
    {title: 'Scientific prefixes', description: 'Milli (10⁻³) and micro (10⁻⁶) use negative exponents to express tiny quantities.'},
    {title: 'Half-life decay', description: 'Radioactive decay can be modelled with negative exponents showing shrinking amounts over time.'},
    {title: 'Reciprocals in recipes', description: 'If a recipe uses 2⁻¹ cup, that means 1/2 cup — negative exponents as fractions in daily life.'},
    {title: 'Computer memory fractions', description: 'A kilobyte is 2¹⁰ bytes; describing a fraction of a byte uses negative powers of 2.'},
  ],
  activities: [
    {title: 'Reciprocal flip cards', instructions: 'Write expressions like 3⁻² on one side and 1/9 on the other. Students match and explain why they are equal.'},
    {title: 'Number line jump', instructions: 'On a powers-of-10 line, start at 10³ and move left three steps to reach 10⁰, then two more to 10⁻². Record each value.'},
    {title: 'Negative exponent simplify race', instructions: 'Simplify 2⁻⁴ × 2⁷, 10⁻² × 10⁻⁵, and p³ × p⁻¹⁰. First correct team explains the product law used.'},
  ],
  quiz: makeQuiz7('negexp', [
    {q: '2⁻⁴ equals:', o: ['-16', '1/16', '1/8', '16'], c: 1, e: '2⁻⁴ = 1/2⁴ = 1/16.'},
    {q: '10⁻³ equals:', o: ['-1000', '0.001', '0.01', '1000'], c: 1, e: '10⁻³ = 1/10³ = 1/1000 = 0.001.'},
    {q: 'n⁻ᵃ = 1/nᵃ is valid when:', o: ['n = 0', 'n ≠ 0', 'a is negative only', 'never'], c: 1, e: 'Division by zero is undefined, so n must not be 0.'},
    {q: '2⁻² ÷ 2⁻⁵ equals:', o: ['2⁻⁷', '2³', '2⁻³', '1'], c: 1, e: '2⁻²⁻⁽⁻⁵⁾ = 2⁻²⁺⁵ = 2³ = 8.'},
    {q: 'Which is equal to 1/5³?', o: ['5⁻³', '-5³', '5³', '(-5)⁻³'], c: 0, e: '5⁻³ = 1/5³.'},
    {q: '10³ written with a negative exponent in the denominator equals:', o: ['10⁻³', '1/10⁻³', '10³', '-10³'], c: 1, e: '10³ = 1/10⁻³.'},
    {q: 'p³ × p⁻¹⁰ simplifies to:', o: ['p⁻⁷', 'p¹³', 'p³⁰', 'p⁻³'], c: 0, e: 'p³⁺⁽⁻¹⁰⁾ = p⁻⁷.'},
  ]),
};

const decimal_exponential_form = {
  topicId: 'decimal_exponential_form',
  topicName: '3. Decimal Numbers in Exponential Form',
  explanation:
    'Decimals can be written using negative exponents of 10. Moving the decimal point one place left multiplies by 10⁻¹. Since 12² = 144, we can find powers of decimal numbers by adjusting place value: (1.2)² = (12/10)² = 144/100 = 1.44; (0.12)² = 144/10000 = 0.0144; (0.012)² = 0.000144; and 120² = 144 × 100 = 14400. The exponent on 10 tracks how many places the decimal shifted. This links ordinary decimals to the laws of exponents.',
  examples: ['(1.2)² = 1.44', '(0.12)² = 0.0144', '172 = 1×10² + 7×10¹ + 2×10⁰', '0.001 = 1×10⁻³'],
  videoUrl: V.decimalExp,
  brainstorming: [
    bs('If 12² = 144, why is (0.12)² much smaller than 1.44?', '0.12 = 12/100, so squaring gives 144/10000 — dividing by 100 twice makes the result 100 times smaller than (1.2)².'),
    bs('How does 10⁻¹ relate to the decimal 0.1?', '10⁻¹ = 1/10 = 0.1 — each negative step on the power of 10 moves the decimal point left.'),
    bs('Can every decimal be written with powers of 10?', 'Many can, especially those with finitely many digits after the decimal point, by expressing each place as a power of 10.'),
  ],
  misconceptions: [
    {wrong: '(0.12)² = 0.144', correct: '(0.12)² = 0.0144 — squaring 0.12 means 0.12 × 0.12, not just moving the decimal one place.'},
    {wrong: '10⁻² = -100', correct: '10⁻² = 1/100 = 0.01 — negative exponent means reciprocal, not a negative number.'},
    {wrong: '120² = 144', correct: '120² = (12×10)² = 144×100 = 14400.'},
    {wrong: 'Decimals cannot use exponent laws', correct: 'Rewrite decimals as fractions with powers of 10, then apply the same laws.'},
  ],
  realLifeConnections: [
    {title: 'Currency and cents', description: '₹1.20 = 1.2 × 10⁰ rupees; small price differences use decimal powers implicitly.'},
    {title: 'Scientific measurements', description: 'A cell width of 0.00001 m is written as 1×10⁻⁵ m — decimals become clean powers of 10.'},
    {title: 'Engineering tolerances', description: 'Machine parts specified to 0.001 cm precision use negative powers of 10 for accuracy.'},
    {title: 'Digital displays', description: 'Multiplying a decimal reading by 10² shifts two places right — like converting metres to centimetres.'},
    {title: 'Medicine dosages', description: 'A dose of 0.25 mg can be expressed as 2.5×10⁻¹ mg for scientific calculation.'},
  ],
  activities: [
    {title: 'Decimal square table', instructions: 'Given 12² = 144, complete a table for (1.2)², (0.12)², (0.012)², and 120² by tracking powers of 10.'},
    {title: 'Place-value expansion', instructions: 'Expand 5642 and 0.0056 as sums of terms like a×10ⁿ. Identify each digit\'s place using exponents.'},
    {title: 'Calculator check', instructions: 'Compute (0.12)² on a calculator and verify it matches 144/10000 from exponent reasoning.'},
  ],
  quiz: makeQuiz7('decexp', [
    {q: 'If 12² = 144, then (1.2)² =', o: ['14.4', '1.44', '0.144', '1440'], c: 1, e: '(12/10)² = 144/100 = 1.44.'},
    {q: '(0.12)² equals:', o: ['0.144', '0.0144', '1.44', '0.00144'], c: 1, e: '(12/100)² = 144/10000 = 0.0144.'},
    {q: '120² equals:', o: ['144', '1440', '14400', '1.44'], c: 2, e: '(12×10)² = 144×100 = 14400.'},
    {q: '0.001 as a power of 10 is:', o: ['10³', '10⁻³', '10⁻¹', '10¹'], c: 1, e: '0.001 = 1/1000 = 10⁻³.'},
    {q: '172 = 1×10² + 7×10¹ + 2×10⁰ shows:', o: ['Prime factorisation', 'Place-value with exponents', 'Negative exponents only', 'Standard form'], c: 1, e: 'Each digit is multiplied by a power of 10 matching its place.'},
    {q: '(0.012)² equals:', o: ['0.000144', '0.00144', '0.0144', '1.44'], c: 0, e: '(12/1000)² = 144/1000000 = 0.000144.'},
    {q: 'Moving decimal 2 places left divides by:', o: ['10²', '10⁻²', '2', '100²'], c: 0, e: 'Each place left divides by 10; two places divides by 10².'},
  ]),
};

const product_law_of_exponents = {
  topicId: 'product_law_of_exponents',
  topicName: '4. Product Law of Exponents',
  explanation:
    'When multiplying powers with the same base, add the exponents: nᵃ × nᵇ = nᵃ⁺ᵇ. This works because nᵃ means a factors of n and nᵇ means b more factors — together there are a + b factors. Example: 2³ × 2⁴ = 2⁷ = 128. The law also holds for negative exponents: 10⁻² × 10⁻⁵ = 10⁻⁷. The base must be the same; you cannot combine 2³ × 3⁴ this way unless you compute values separately.',
  examples: ['2³ × 2⁴ = 2⁷ = 128', '5² × 5³ = 5⁵ = 3125', '10⁻² × 10⁻⁵ = 10⁻⁷', 'p³ × p⁻¹⁰ = p⁻⁷'],
  videoUrl: V.productLaw,
  brainstorming: [
    bs('Why do we add exponents when bases match?', 'Multiplying nᵃ × nᵇ joins a factors with b factors — total of a + b factors of n.'),
    bs('Can 2³ × 3² be simplified with one exponent?', 'No — different bases. Evaluate 8 × 9 = 72 or leave as 2³ × 3².'),
    bs('Does the product law work for n⁰?', 'Yes: 2³ × 2⁰ = 2³ since 2⁰ = 1.'),
  ],
  misconceptions: [
    {wrong: '2³ × 2⁴ = 2¹²', correct: 'Add exponents: 2³⁺⁴ = 2⁷, not multiply them.'},
    {wrong: '2³ × 3² = 6⁵', correct: 'Bases differ — cannot combine exponents. 2³ × 3² = 8 × 9 = 72.'},
    {wrong: 'nᵃ × nᵇ = (nᵃ)ᵇ', correct: 'Product law adds exponents; power-of-a-power multiplies them.'},
    {wrong: '10⁻² × 10⁻⁵ = 10¹⁰', correct: '10⁻²⁺⁽⁻⁵⁾ = 10⁻⁷.'},
  ],
  realLifeConnections: [
    {title: 'Combining bacterial generations', description: 'Doubling twice then three more times is 2² × 2³ = 2⁵ total doubling factor.'},
    {title: 'Stacking discounts', description: 'Two successive 10% reductions are not additive — but repeated scaling by powers models compounded effects.'},
    {title: 'Area scaling', description: 'Scaling a square side by 10² then 10³ multiplies area factor by 10⁵.'},
    {title: 'Memory addressing', description: 'Combining 2¹⁰ address lines with 2³ banks gives 2¹³ total addresses.'},
    {title: 'Chemistry concentrations', description: 'Diluting twice: multiply concentration factors using product of powers when same base ratio applies.'},
  ],
  activities: [
    {title: 'Exponent addition strips', instructions: 'Cut strips showing 2³ as three 2-blocks and 2⁴ as four 2-blocks. Join and count seven blocks → 2⁷.'},
    {title: 'Same-base sort', instructions: 'Sort cards into groups with matching bases. Simplify each group using the product law.'},
    {title: 'Error hunt', instructions: 'Find mistakes in expressions like 3⁴ × 3² = 3⁸ and 5⁻¹ × 5³ = 5⁻⁴. Correct and explain.'},
  ],
  quiz: makeQuiz7('prod', [
    {q: '2⁵ × 2³ =', o: ['2⁸', '2¹⁵', '4⁸', '2²'], c: 0, e: 'Add exponents: 2⁵⁺³ = 2⁸.'},
    {q: '10⁻² × 10⁻⁵ =', o: ['10⁻⁷', '10⁻³', '10¹⁰', '10⁷'], c: 0, e: '-2 + (-5) = -7.'},
    {q: 'p³ × p⁻¹⁰ =', o: ['p⁻⁷', 'p¹³', 'p⁻³', 'p³⁰'], c: 0, e: '3 + (-10) = -7.'},
    {q: 'Which cannot use the product law directly?', o: ['2³ × 2⁴', '5⁻¹ × 5²', '2³ × 3²', '10⁶ × 10⁻²'], c: 2, e: 'Bases 2 and 3 are different.'},
    {q: '3² × 3⁰ =', o: ['3²', '3⁰', '9²', '0'], c: 0, e: '3⁰ = 1, so result is 3².'},
    {q: 'm⁵ × n⁵ simplifies to:', o: ['(mn)⁵', 'm⁵⁺⁵', '(m+n)⁵', 'Cannot simplify with product law alone'], c: 0, e: 'Same exponent on different bases → power of a product: (mn)⁵.'},
    {q: '2⁻⁴ × 2⁷ =', o: ['2³', '2⁻¹¹', '2¹¹', '2²⁸'], c: 0, e: '-4 + 7 = 3.'},
  ]),
};

const quotient_law_of_exponents = {
  topicId: 'quotient_law_of_exponents',
  topicName: '5. Quotient Law of Exponents',
  explanation:
    'When dividing powers with the same base, subtract the exponents: nᵃ ÷ nᵇ = nᵃ⁻ᵇ (n ≠ 0). Example: 2¹⁰⁰ ÷ 2²⁵ = 2⁷⁵. Cancelling b factors from a factors leaves a − b factors. This law explains negative exponents: 2⁰ ÷ 2⁵ = 2⁻⁵ = 1/32. It also works when exponents are negative: 2⁻² ÷ 2⁻⁵ = 2³ = 8.',
  examples: ['5⁷ ÷ 5⁴ = 5³ = 125', '2¹⁰⁰ ÷ 2²⁵ = 2⁷⁵', '9⁻⁷ ÷ 9⁴ = 9⁻¹¹', '10⁴ ÷ 5⁴ = (10/5)⁴ = 2⁴'],
  videoUrl: V.quotientLaw,
  brainstorming: [
    bs('Why can n not be 0 in nᵃ ÷ nᵇ?', 'If n = 0, the denominator 0ᵇ (b > 0) is 0, giving division by zero — undefined.'),
    bs('What happens when a = b?', 'nᵃ ÷ nᵃ = n⁰ = 1 — any non-zero base to power 0 is 1.'),
    bs('How does quotient law create negative exponents?', '2³ ÷ 2⁵ = 2⁻² = 1/4 — subtracting gives a negative exponent meaning reciprocal.'),
  ],
  misconceptions: [
    {wrong: '5⁷ ÷ 5⁴ = 5³/⁴', correct: 'Subtract exponents: 5⁷⁻⁴ = 5³.'},
    {wrong: '2¹⁰⁰ ÷ 2²⁵ = 2⁴', correct: '100 - 25 = 75, so 2⁷⁵.'},
    {wrong: 'nᵃ ÷ nᵇ works when n = 0', correct: 'Division by zero is undefined — n must be non-zero.'},
    {wrong: '9⁻⁷ ÷ 9⁴ = 9³', correct: '-7 - 4 = -11, so 9⁻¹¹.'},
    {wrong: 'You divide the bases: 6⁴ ÷ 2⁴ = 3⁴', correct: 'Same exponent different bases: (6/2)⁴ = 3⁴ — quotient law on bases, not subtracting unlike bases.'},
  ],
  realLifeConnections: [
    {title: 'Comparing cell counts', description: 'If bacteria double daily, ratio after 100 days vs 25 days is 2¹⁰⁰ ÷ 2²⁵ = 2⁷⁵.'},
    {title: 'Signal attenuation', description: 'Signal halving each km: after 10 km vs 3 km, strength ratio is 2¹⁰ ÷ 2³ = 2⁷.'},
    {title: 'Storage tiers', description: 'Ratio of 1 TB (2⁴⁰ bytes) to 1 GB (2³⁰ bytes) is 2¹⁰.'},
    {title: 'Population ratios', description: 'Comparing 10⁹ people to 10⁶ uses 10⁹ ÷ 10⁶ = 10³.'},
    {title: 'Simplifying fractions', description: '10⁴/5⁴ = (10/5)⁴ = 2⁴ — quotient of powers with same exponent.'},
  ],
  activities: [
    {title: 'Cancel and count', instructions: 'Write 2⁵/2² as (2×2×2×2×2)/(2×2). Cancel two 2s and count three left → 2³.'},
    {title: 'Quotient law relay', instructions: 'Teams simplify 5⁷÷5⁴, 9⁻⁷÷9⁴, 2⁻²÷2⁻⁵. Pass the answer to the next teammate.'},
    {title: 'Zero exponent discovery', instructions: 'Compute 3⁴÷3⁴, 7⁶÷7⁶, aⁿ÷aⁿ. What pattern do you notice?'},
  ],
  quiz: makeQuiz7('quot', [
    {q: '5⁷ ÷ 5⁴ =', o: ['5³', '5¹¹', '5⁷/⁴', '1³'], c: 0, e: '7 - 4 = 3.'},
    {q: '2¹⁰⁰ ÷ 2²⁵ =', o: ['2⁷⁵', '2⁴', '2¹²⁵', '2²⁵'], c: 0, e: '100 - 25 = 75.'},
    {q: '9⁻⁷ ÷ 9⁴ =', o: ['9⁻¹¹', '9⁻³', '9³', '9¹¹'], c: 0, e: '-7 - 4 = -11.'},
    {q: 'nᵃ ÷ nᵃ equals:', o: ['n⁰', '0', '1', 'n²ᵃ'], c: 0, e: 'a - a = 0, and n⁰ = 1 for n ≠ 0.'},
    {q: '2⁻² ÷ 2⁻⁵ =', o: ['2³', '2⁻⁷', '2⁻³', '1'], c: 0, e: '-2 - (-5) = 3.'},
    {q: 'Why must n ≠ 0?', o: ['Negative exponents fail', 'Division by zero is undefined', 'n⁰ is undefined', 'Exponents must be positive'], c: 1, e: '0ᵇ = 0 for b > 0, causing division by zero.'},
    {q: '10⁴ ÷ 5⁴ =', o: ['2⁴', '5⁴', '10⁴/⁵', '(10-5)⁴'], c: 0, e: '(10/5)⁴ = 2⁴.'},
  ]),
};

const power_of_a_power = {
  topicId: 'power_of_a_power',
  topicName: '6. Power of a Power',
  explanation:
    'When raising a power to another power, multiply the exponents: (nᵃ)ᵇ = nᵃˣᵇ. For example, (2³)² = 2⁶ = 64 because (2³)² = 2³ × 2³. Similarly, (13⁻²)⁻³ = 13⁶. This law helps rewrite large expressions compactly: 8⁶ can be written as (2³)⁶ = 2¹⁸ or (2²)⁹ = 2¹⁸. It is one of the most useful shortcuts when simplifying nested exponents.',
  examples: ['(2³)² = 2⁶ = 64', '(5²)³ = 5⁶ = 15625', '(13⁻²)⁻³ = 13⁶', '(10²)³ = 10⁶ = 1000000'],
  videoUrl: V.powerPower,
  brainstorming: [
    bs('Why multiply exponents in (nᵃ)ᵇ?', 'nᵃ repeated b times means a × b total factors of n.'),
    bs('How is (2³)² different from 2³²?', '(2³)² = 2⁶ = 64, but 2³² = 2⁹ = 512 — brackets matter!'),
    bs('What does (n⁻²)⁻³ become?', 'Multiply exponents: n⁽⁻²⁾ˣ⁽⁻³⁾ = n⁶ — negative × negative is positive.'),
  ],
  misconceptions: [
    {wrong: '(2³)² = 2⁵', correct: 'Multiply exponents: 2³ˣ² = 2⁶.'},
    {wrong: '(nᵃ)ᵇ = nᵃ⁺ᵇ', correct: 'That is the product law. Power of a power multiplies: nᵃˣᵇ.'},
    {wrong: '(13⁻²)⁻³ = 13⁻⁶', correct: '(-2)×(-3) = 6, so 13⁶.'},
    {wrong: '(2²)³ = 2⁵', correct: '2²ˣ³ = 2⁶ = 64.'},
  ],
  realLifeConnections: [
    {title: 'Nested scaling', description: 'Scaling by 10² then cubing the scale factor gives (10²)³ = 10⁶ overall magnification.'},
    {title: 'Fractal repetition', description: 'Each level triples detail: (3²)⁴ patterns model repeated subdivision in art and nature.'},
    {title: 'Cryptography layers', description: 'Applying a square operation twice on a key space can be modelled as a power of a power.'},
    {title: 'Volume of cubes', description: '(side²)³ relates to expressing volume using power-of-a-power when side is itself a power.'},
    {title: 'Rewriting 64³', description: '64³ = (2⁶)³ = 2¹⁸ — compact form for very large numbers.'},
  ],
  activities: [
    {title: 'Bracket challenge', instructions: 'Compare (3²)⁴ and 3²⁴. Compute both and discuss why parentheses change the answer.'},
    {title: 'Power tower simplify', instructions: 'Simplify (5²)³, (2⁻¹)⁴, and (10³)² using the multiply-exponents rule.'},
    {title: 'Two ways same answer', instructions: 'Write 8⁶ as both (2³)⁶ and (2²)⁹. Verify both equal 2¹⁸.'},
  ],
  quiz: makeQuiz7('pop', [
    {q: '(2³)² =', o: ['2⁵', '2⁶', '2⁹', '6²'], c: 1, e: '3 × 2 = 6, so 2⁶.'},
    {q: '(13⁻²)⁻³ =', o: ['13⁻⁶', '13⁶', '13⁻⁵', '13⁵'], c: 1, e: '(-2)×(-3) = 6.'},
    {q: '(5²)³ =', o: ['5⁵', '5⁶', '5⁸', '25³'], c: 1, e: '2 × 3 = 6.'},
    {q: '(10²)³ =', o: ['10⁵', '10⁶', '10⁸', '100³'], c: 1, e: '2 × 3 = 6 → 10⁶.'},
    {q: '(nᵃ)ᵇ =', o: ['nᵃ⁺ᵇ', 'nᵃ⁻ᵇ', 'nᵃˣᵇ', 'nᵃ/ᵇ'], c: 2, e: 'Power of a power multiplies exponents.'},
    {q: '(2²)³ =', o: ['2⁵', '2⁶', '2⁸', '64'], c: 1, e: '2 × 3 = 6.'},
    {q: '(3⁻¹)² =', o: ['3⁻²', '3²', '3⁻³', '9'], c: 0, e: '(-1) × 2 = -2.'},
  ]),
};

const power_of_a_product = {
  topicId: 'power_of_a_product',
  topicName: '7. Power of a Product',
  explanation:
    'When the same exponent applies to a product, distribute it to each factor: (mn)ᵃ = mᵃ × nᵃ. Example: (2×5)³ = 2³ × 5³ = 8 × 125 = 1000. This also works in reverse to simplify: 2⁴ × 3⁴ = (2×3)⁴ = 6⁴. The law connects multiplication inside brackets with adding the same power to each part.',
  examples: ['(2×5)³ = 2³ × 5³ = 1000', '2⁴ × 3⁴ = 6⁴ = 1296', '(ab)² = a²b²', '(-3)² × (-5)² = 9 × 25 = 225'],
  videoUrl: V.productLaw,
  brainstorming: [
    bs('Why does (2×5)³ equal 2³ × 5³?', 'Expanding (2×5)³ = (2×5)(2×5)(2×5) — each bracket picks one 2 and one 5, giving three 2s and three 5s.'),
    bs('Can (2+3)² = 2² + 3²?', 'No! (2+3)² = 25 but 2²+3² = 13. Power of a product works for multiplication, not addition.'),
    bs('How does this help simplify 2⁴ × 3⁴?', 'Same exponent → combine bases: (2×3)⁴ = 6⁴.'),
  ],
  misconceptions: [
    {wrong: '(2+3)² = 2² + 3²', correct: '(2+3)² = 25, but 2²+3² = 13. The law applies to products, not sums.'},
    {wrong: '(2×5)³ = 2×5³', correct: 'Both factors get the exponent: 2³ × 5³.'},
    {wrong: '2³ × 3⁴ = 6⁷', correct: 'Exponents differ — cannot combine. 2³ × 3⁴ = 8 × 81 = 648.'},
    {wrong: '(mn)ᵃ = mᵃ + nᵃ', correct: 'It is mᵃ × nᵃ (multiplication), not addition.'},
  ],
  realLifeConnections: [
    {title: 'Box dimensions', description: 'Volume of a rectangular box (l×w×h)² for scaling all sides doubles each dimension factor together.'},
    {title: 'Team combinations', description: '(2×3)⁴ patterns appear when independent choices each have the same number of rounds.'},
    {title: 'Engineering stress', description: 'Force on (a×b)² area distributes as a² × b² when each dimension scales equally.'},
    {title: 'Chemistry moles', description: '(2×3)³ molecule counts split into 2³ and 3³ when counting arrangements.'},
    {title: 'Currency pairs', description: 'Converting (₹×$)ⁿ transactions splits into ₹ⁿ and $ⁿ factors.'},
  ],
  activities: [
    {title: 'Expand and compare', instructions: 'Compute (2×3)² by expanding brackets and by 2²×3². Show both give 36.'},
    {title: 'Sum vs product trap', instructions: 'Test (2+3)² vs 2²+3². Discuss why only multiplication distributes the exponent.'},
    {title: 'Simplify products', instructions: 'Rewrite 2⁴×3⁴, 5²×7², and 2³×a³ in the form (product)ⁿ.'},
  ],
  quiz: makeQuiz7('poprod', [
    {q: '(2×5)³ =', o: ['2³×5³', '10³ only', '2+5³', '2³+5³'], c: 0, e: 'Each factor is cubed: 2³ × 5³.'},
    {q: '2⁴ × 3⁴ =', o: ['6⁴', '6⁸', '5⁴', '6⁷'], c: 0, e: 'Same exponent: (2×3)⁴ = 6⁴.'},
    {q: '(ab)² =', o: ['a²b²', 'a²+b²', '2ab', '(a+b)²'], c: 0, e: 'Power distributes over multiplication.'},
    {q: '(2+3)² equals:', o: ['25', '13', '10²', '2²+3²'], c: 0, e: '(2+3)² = 5² = 25, not 2²+3².'},
    {q: 'm⁵ × n⁵ =', o: ['(mn)⁵', 'm⁵⁺⁵', '(m+n)⁵', 'm⁵/n⁵'], c: 0, e: 'Same exponent on different bases → (mn)⁵.'},
    {q: '(-3)² × (-5)² =', o: ['225', '-225', '15²', '(-15)²'], c: 0, e: '9 × 25 = 225 — both squares are positive.'},
    {q: '(2×3)⁴ =', o: ['2⁴×3⁴', '6⁴', 'Both A and B', '2⁴+3⁴'], c: 2, e: '2⁴×3⁴ = 6⁴ = 1296.'},
  ]),
};

const power_of_a_quotient = {
  topicId: 'power_of_a_quotient',
  topicName: '8. Power of a Quotient',
  explanation:
    'When the same exponent applies to a quotient, distribute to numerator and denominator: (m/n)ᵃ = mᵃ/nᵃ. Example: (10/5)⁴ = 10⁴/5⁴ = 2⁴ = 16. This is how we simplify 10⁴/5⁴ without computing huge numbers. It also explains (2/3)³ = 2³/3³ = 8/27. The base must be a quotient of two numbers raised to the same power.',
  examples: ['(10/5)⁴ = 2⁴ = 16', '10⁴/5⁴ = 2⁴', '(2/3)³ = 8/27', 'm⁵/n¹² × (mn)⁹ needs careful grouping'],
  videoUrl: V.powerQuotient,
  brainstorming: [
    bs('Why is 10⁴/5⁴ equal to 2⁴?', 'Each of four factors has 10/5 = 2, so (10/5)⁴ = 2⁴.'),
    bs('Does (m/n)ᵃ = mᵃ/nᵃ work for negative a?', 'Yes: (2/3)⁻² = 2⁻²/3⁻² = (3/2)².'),
    bs('What is m⁵/n¹² × (mn)⁹?', 'Rewrite (mn)⁹ = m⁹n⁹. Then m⁵⁺⁹/n¹²⁻⁹ = m¹⁴/n³.'),
  ],
  misconceptions: [
    {wrong: '(10/5)⁴ = 10/5⁴', correct: 'Both numerator and denominator are raised: 10⁴/5⁴.'},
    {wrong: '10⁴/5⁴ = 2', correct: '2⁴ = 16, not 2. The exponent applies to the quotient.'},
    {wrong: '(m-n)² = m²-n²', correct: 'Power of a quotient is for division, not subtraction.'},
    {wrong: 'aᵐ/bᵐ = (a-b)ᵐ', correct: 'aᵐ/bᵐ = (a/b)ᵐ.'},
  ],
  realLifeConnections: [
    {title: 'Unit conversion ratios', description: 'Comparing 10⁴ metres to 5⁴ metres uses (10/5)⁴ = 2⁴ scaling factor.'},
    {title: 'Concentration ratios', description: 'Dilution factors expressed as (1/10)³ show power of a quotient in chemistry.'},
    {title: 'Gear ratios', description: 'Repeated gear pairs (A/B)ⁿ model cumulative rotation ratios.'},
    {title: 'Probability odds', description: '(1/2)ⁿ for n coin tosses all heads uses power of a quotient.'},
    {title: 'Simplifying large fractions', description: '10⁴/5⁴ avoids computing 10000/625 directly — use 2⁴ = 16.'},
  ],
  activities: [
    {title: 'Fraction power split', instructions: 'Show (6/2)³ = 6³/2³ = 216/8 = 27. Verify by direct division.'},
    {title: 'Simplify 10⁴/5⁴', instructions: 'Use the quotient power law before calculating. Compare effort with direct division.'},
    {title: 'Mixed expression', instructions: 'Simplify m⁵/n¹² × (mn)⁹ step by step. Identify quotient and product laws used.'},
  ],
  quiz: makeQuiz7('poq', [
    {q: '10⁴ ÷ 5⁴ =', o: ['2⁴', '5⁴', '2', '10⁴/⁵'], c: 0, e: '(10/5)⁴ = 2⁴ = 16.'},
    {q: '(m/n)ᵃ =', o: ['mᵃ/nᵃ', 'mᵃ-nᵃ', '(m-n)ᵃ', 'm/nᵃ'], c: 0, e: 'Exponent applies to both numerator and denominator.'},
    {q: '(2/3)³ =', o: ['8/27', '6/9', '2/27', '8/9'], c: 0, e: '2³/3³ = 8/27.'},
    {q: '(10/5)⁴ =', o: ['16', '2', '10⁴/5', '5⁴/10'], c: 0, e: '2⁴ = 16.'},
    {q: 'aᵐ/bᵐ simplifies to:', o: ['(a/b)ᵐ', '(a-b)ᵐ', 'aᵐ⁻ᵐ', 'a/b'], c: 0, e: 'Same exponent → power of quotient.'},
    {q: 'm⁵/n¹² × (mn)⁹ =', o: ['m¹⁴/n³', 'm¹⁴n³', 'm⁻⁴/n²¹', '(mn)¹⁴'], c: 0, e: 'm⁵⁺⁹/n¹²⁻⁹ = m¹⁴/n³.'},
    {q: '(6/2)³ =', o: ['27', '3³', '6³/2', '18'], c: 0, e: '6³/2³ = 216/8 = 27.'},
  ]),
};

const standard_form = {
  topicId: 'standard_form',
  topicName: '9. Standard Form',
  explanation:
    'Standard form (scientific notation) writes numbers as a × 10ⁿ where 1 ≤ a < 10 and n is an integer. Large numbers move the decimal left and use positive n: 59,853 = 5.9853 × 10⁴. Small numbers move the decimal right and use negative n: 0.001 = 1 × 10⁻³. Powers of 10 make it easy to express distances in space, mass of planets, and microscopic lengths without long strings of zeros.',
  examples: [
    '59,853 = 5.9853 × 10⁴',
    '6,374 = 6.374 × 10³',
    '0.001 = 1 × 10⁻³',
    '7,00,40,00,00,000 = 7.004 × 10¹⁰',
  ],
  videoUrl: V.standardForm,
  brainstorming: [
    bs('Why must a be between 1 and 10?', 'One non-zero digit before the decimal keeps a standard unique form — 59853 and 5.9853×10⁴ are the same number.'),
    bs('How do you pick n for 0.001?', 'Move decimal 3 places right to get 1.0, so n = -3.'),
    bs('How is 172 written with powers of 10?', '1×10² + 7×10¹ + 2×10⁰ — place-value expansion using exponents.'),
  ],
  misconceptions: [
    {wrong: '59,853 = 59.853 × 10³ is standard form', correct: 'a must satisfy 1 ≤ a < 10. Correct: 5.9853 × 10⁴.'},
    {wrong: '10⁻³ = -1000', correct: '10⁻³ = 0.001 — negative exponent means small, not negative.'},
    {wrong: 'Standard form always has positive n', correct: 'Numbers less than 1 use negative n.'},
    {wrong: '6374 = 6374 × 10⁰ is preferred', correct: '6.374 × 10³ is cleaner standard form.'},
  ],
  realLifeConnections: [
    {title: 'Earth–Sun distance', description: '1.496 × 10¹¹ m — standard form avoids writing 149,600,000,000 m.'},
    {title: 'Mass of the Earth', description: '5.976 × 10²⁴ kg — powers of 10 handle astronomical mass.'},
    {title: 'Bacterial cell size', description: 'About 1 × 10⁻⁶ m — negative exponent for microscopic scale.'},
    {title: 'National budgets', description: '₹7.004 × 10¹⁰ expresses crores-scale spending compactly.'},
    {title: 'PIN codes and 10ⁿ', description: '6-digit PINs use 10⁶ combinations — powers of 10 in daily systems.'},
  ],
  activities: [
    {title: 'Decimal shift drill', instructions: 'Convert 65,950, 0.00056, and 3,43,00,000 to standard form. Count decimal jumps for n.'},
    {title: 'Place-value poster', instructions: 'Expand 5642 and 6374 as sums of a×10ⁿ terms. Colour-code each power of 10.'},
    {title: 'Real data hunt', instructions: 'Find three news facts with very large or small numbers. Rewrite each in standard form.'},
  ],
  quiz: makeQuiz7('std', [
    {q: '59,853 in standard form is:', o: ['5.9853 × 10⁴', '59.853 × 10³', '5.9853 × 10⁵', '0.59853 × 10⁵'], c: 0, e: 'Move decimal 4 places left: n = 4.'},
    {q: '0.001 in standard form is:', o: ['1 × 10⁻³', '1 × 10³', '10⁻³ only', '0.1 × 10⁻²'], c: 0, e: 'Three places right → n = -3.'},
    {q: 'In a × 10ⁿ, a must satisfy:', o: ['1 ≤ a < 10', 'a > 10', 'a < 1', 'any a'], c: 0, e: 'Standard form requires one digit before the decimal.'},
    {q: '7,00,40,00,00,000 =', o: ['7.004 × 10¹⁰', '7.004 × 10⁹', '70.04 × 10⁹', '7.004 × 10¹¹'], c: 0, e: '10 places from ones digit → n = 10.'},
    {q: '6374 = 6 × 10³ + 3 × 10² + 7 × 10¹ + 4 × 10⁰ shows:', o: ['Place-value expansion', 'Prime factors', 'Negative exponents', 'Quotient law'], c: 0, e: 'Each digit times its place power of 10.'},
    {q: '3,43,00,000 in standard form:', o: ['3.43 × 10⁶', '3.43 × 10⁷', '34.3 × 10⁵', '3.43 × 10⁸'], c: 0, e: 'Decimal moves 6 places left.'},
    {q: 'Scientific notation uses powers of:', o: ['2', '10', '100', 'any base'], c: 1, e: 'Standard form is based on powers of 10.'},
  ]),
};

const comparing_standard_form = {
  topicId: 'comparing_standard_form',
  topicName: '10. Comparing Large and Small Numbers',
  explanation:
    'To compare numbers in standard form, first compare the exponent n. For large positive numbers, bigger exponent means bigger value. If exponents match, compare the coefficient a. For small numbers (negative exponents), exponent closer to zero is larger: 10⁻² > 10⁻⁵. Example: 3.2×10⁸ > 5.7×10⁷ because 8 > 7.',
  examples: [
    '3.2×10⁸ > 5.7×10⁷ (compare exponents: 8 > 7)',
    '8.2×10⁶ > 3.5×10⁶ (same exponent, compare 8.2 > 3.5)',
    '5×10⁻⁴ > 5×10⁻⁶ (10⁻⁴ is larger than 10⁻⁶)',
    '9×10⁵ < 2×10⁶ (exponent 6 beats coefficient 9)',
  ],
  videoUrl: V.comparing,
  brainstorming: [
    bs('Which is smaller: 1.49×10¹¹ m or 1.439×10¹² m?', '1.49×10¹¹ = 1.49×10¹¹ vs 1.439×10¹² = 14.39×10¹¹ — the second is about 10 times larger.'),
    bs('How do you compare 4³ and 3⁴?', 'Compute: 4³ = 64, 3⁴ = 81. So 3⁴ > 4³ despite smaller base.'),
    bs('Is 2¹⁰⁰ bigger than 100²?', '100² = 10,000. 2¹⁰⁰ ≈ 1.27×10³⁰ — vastly larger.'),
  ],
  misconceptions: [
    {wrong: 'Bigger exponent always means bigger number for all a', correct: 'For 0 < a < 1, higher positive n can mean smaller value. Context matters.'},
    {wrong: '4³ > 3⁴ because base 4 > 3', correct: '4³ = 64, 3⁴ = 81 — compare values, not just bases.'},
    {wrong: '10⁹ + 10⁹ = 10¹⁸', correct: '10⁹ + 10⁹ = 2×10⁹, not add exponents.'},
    {wrong: '2¹⁰⁰ and 100² are close', correct: '100² = 10,000; 2¹⁰⁰ has about 30 digits.'},
    {wrong: 'Scientific notation numbers cannot be compared', correct: 'Align exponents, then compare coefficients.'},
  ],
  realLifeConnections: [
    {title: 'Planet distances', description: 'Comparing Sun–Saturn vs Sun–Earth distances uses aligned powers of 10.'},
    {title: 'Ants per human', description: '2×10¹⁶ ants ÷ 8×10⁹ people ≈ 2.5×10⁶ ants per person.'},
    {title: 'Starling flocks', description: '3.1×10⁸ starlings ÷ 10⁴ per flock = 3.1×10⁴ flocks worldwide.'},
    {title: 'Paper to the Moon', description: '3.84×10⁸ m ÷ 10⁻⁴ m per sheet = 3.84×10¹² sheets.'},
    {title: 'Sheep and goats', description: '10⁹ + 10⁹ = 2×10⁹ total — not 10¹⁸.'},
  ],
  activities: [
    {title: 'Order the distances', instructions: 'Rank Sun–Earth, Sun–Saturn, and Saturn–Uranus distances given in standard form. Show alignment steps.'},
    {title: 'Greater or lesser', instructions: 'Decide which is greater: 4³ or 3⁴, 2⁸ or 8², 100² or 2¹⁰⁰. Calculate before answering.'},
    {title: 'Ratio calculator', instructions: 'Compute humans per elephant (8×10⁹ ÷ 4×10⁵) and express in scientific notation.'},
  ],
  quiz: makeQuiz7('cmp', [
    {q: 'Which is greater: 4³ or 3⁴?', o: ['4³', '3⁴', 'Equal', 'Cannot tell'], c: 1, e: '4³ = 64, 3⁴ = 81.'},
    {q: '2⁸ vs 8²:', o: ['2⁸ is greater', '8² is greater', 'Equal', '2⁸ = 64, 8² = 64'], c: 0, e: '2⁸ = 256, 8² = 64.'},
    {q: '100² vs 2¹⁰⁰:', o: ['100²', '2¹⁰⁰', 'Equal', '100² by a little'], c: 1, e: '2¹⁰⁰ is astronomically larger than 10,000.'},
    {q: '10⁹ + 10⁹ equals:', o: ['2×10⁹', '10¹⁸', '10¹⁰', '20⁹'], c: 0, e: 'Same term twice → 2×10⁹.'},
    {q: 'Smallest distance: 1.4335×10¹², 1.439×10¹², 1.496×10¹¹ m:', o: ['1.496×10¹¹', '1.4335×10¹²', '1.439×10¹²', 'All equal'], c: 0, e: '1.496×10¹¹ = 0.1496×10¹² — smallest.'},
    {q: '8×10⁹ ÷ 4×10⁵ =', o: ['2×10⁴', '2×10⁹', '4×10⁴', '2×10⁵'], c: 0, e: '8/4 = 2; 10⁹⁻⁵ = 10⁴.'},
    {q: 'To compare a₁×10ⁿ and a₂×10ᵐ, first:', o: ['Add exponents', 'Align to same power of 10', 'Multiply coefficients', 'Ignore exponents'], c: 1, e: 'Convert to the same 10ᵏ to compare coefficients.'},
  ]),
};

const {exercise_2_1, exercise_2_2, exercise_2_3} = require('./generate-cbse-8-math-powers-exercises');

module.exports = {
  TOPICS: [
    introduction_to_powers,
    negative_integral_exponents,
    decimal_exponential_form,
    product_law_of_exponents,
    quotient_law_of_exponents,
    power_of_a_power,
    power_of_a_product,
    power_of_a_quotient,
    standard_form,
    comparing_standard_form,
    exercise_2_1,
    exercise_2_2,
    exercise_2_3,
  ],
};
