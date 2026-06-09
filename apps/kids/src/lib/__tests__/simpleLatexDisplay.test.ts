import {parseSimpleLatex, toSuperscript} from '../simpleLatexDisplay';

describe('toSuperscript', () => {
  it('converts digits and minus', () => {
    expect(toSuperscript('3')).toBe('³');
    expect(toSuperscript('-3')).toBe('⁻³');
  });
});

describe('parseSimpleLatex', () => {
  it('parses digit powers', () => {
    expect(parseSimpleLatex('5^{3}')).toEqual([
      {kind: 'power', base: '5', exp: '3'},
    ]);
  });

  it('parses powers of ten', () => {
    expect(parseSimpleLatex('10^{6}')).toEqual([
      {kind: 'power', base: '10', exp: '6'},
    ]);
  });

  it('parses equations', () => {
    expect(parseSimpleLatex('2^{3} = 8')).toEqual([
      {kind: 'power', base: '2', exp: '3'},
      {kind: 'text', value: ' = 8'},
    ]);
  });

  it('parses negative exponents', () => {
    expect(parseSimpleLatex('2^{-3}')).toEqual([
      {kind: 'power', base: '2', exp: '-3'},
    ]);
  });

  it('parses multiplication chains', () => {
    expect(parseSimpleLatex('2^{8}\\times')).toEqual([
      {kind: 'power', base: '2', exp: '8'},
      {kind: 'text', value: '×'},
    ]);
  });

  it('parses fraction powers', () => {
    expect(parseSimpleLatex(String.raw`\left(\frac{1}{2}\right)^{-1}`)).toEqual([
      {kind: 'text', value: '(1/2)'},
      {kind: 'power', base: '', exp: '-1'},
    ]);
  });
});
