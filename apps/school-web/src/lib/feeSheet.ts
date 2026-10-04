import * as XLSX from 'xlsx';

export interface FeeSheetRow {
  row: number;
  className: string;
  name: string;
  rollNo: string;
  month: string;
  amountDue: string;
  amountPaid: string;
}

const MAX_ROWS = 400;

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function cellText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function monthValue(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  if (typeof value === 'number' && value > 20000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}`;
  }
  const text = cellText(value);
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) return text;
  if (/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(text)) return text.slice(0, 7);
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }
  return text;
}

const CLASS_HEADERS = new Set(['class', 'classname']);
const NAME_HEADERS = new Set(['name', 'studentname', 'student']);
const ROLL_HEADERS = new Set(['roll', 'rollno', 'rollnumber']);
const MONTH_HEADERS = new Set(['month', 'feemonth']);
const DUE_HEADERS = new Set(['amountdue', 'due', 'feedue']);
const PAID_HEADERS = new Set(['amountpaid', 'paid', 'feepaid']);

export function parseFeeSheet(file: ArrayBuffer): FeeSheetRow[] {
  const book = XLSX.read(file, {type: 'array'});
  const sheetName = book.SheetNames[0];
  if (!sheetName) throw new Error('The file has no sheet.');
  const grid = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: true,
  });
  const header = grid[0] ?? [];
  const columns = {className: -1, name: -1, rollNo: -1, month: -1, amountDue: -1, amountPaid: -1};
  header.forEach((cell, index) => {
    const key = headerKey(cellText(cell));
    if (columns.className < 0 && CLASS_HEADERS.has(key)) columns.className = index;
    else if (columns.name < 0 && NAME_HEADERS.has(key)) columns.name = index;
    else if (columns.rollNo < 0 && ROLL_HEADERS.has(key)) columns.rollNo = index;
    else if (columns.month < 0 && MONTH_HEADERS.has(key)) columns.month = index;
    else if (columns.amountDue < 0 && DUE_HEADERS.has(key)) columns.amountDue = index;
    else if (columns.amountPaid < 0 && PAID_HEADERS.has(key)) columns.amountPaid = index;
  });
  if (columns.className < 0 || columns.name < 0 || columns.rollNo < 0 || columns.month < 0 || columns.amountDue < 0 || columns.amountPaid < 0) {
    throw new Error('The first row must include Class, Name, Roll number, Month, Amount due, and Amount paid.');
  }

  const rows: FeeSheetRow[] = [];
  for (let index = 1; index < grid.length; index++) {
    const line = grid[index] ?? [];
    const row: FeeSheetRow = {
      row: index + 1,
      className: cellText(line[columns.className]),
      name: cellText(line[columns.name]),
      rollNo: cellText(line[columns.rollNo]),
      month: monthValue(line[columns.month]),
      amountDue: cellText(line[columns.amountDue]),
      amountPaid: cellText(line[columns.amountPaid]),
    };
    if (!row.className && !row.name && !row.rollNo && !row.month && !row.amountDue && !row.amountPaid) continue;
    rows.push(row);
  }
  if (rows.length === 0) throw new Error('The file has no fee rows.');
  if (rows.length > MAX_ROWS) throw new Error(`Upload at most ${MAX_ROWS} rows at a time.`);
  return rows;
}
