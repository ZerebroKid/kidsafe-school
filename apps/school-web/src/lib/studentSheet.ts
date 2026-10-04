import * as XLSX from 'xlsx';

export interface StudentSheetRow {
  row: number;
  name: string;
  rollNo: string;
  parentName: string;
  parentPhone: string;
}

const MAX_ROWS = 400;

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function cellText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

const NAME_HEADERS = new Set(['name', 'studentname', 'student']);
const ROLL_HEADERS = new Set(['roll', 'rollno', 'rollnumber']);
const PARENT_HEADERS = new Set(['parent', 'parentname']);
const PHONE_HEADERS = new Set(['phone', 'parentphone', 'mobile', 'mobilenumber']);

export function parseStudentSheet(file: ArrayBuffer): StudentSheetRow[] {
  const book = XLSX.read(file, {type: 'array'});
  const sheetName = book.SheetNames[0];
  if (!sheetName) throw new Error('The file has no sheet.');
  const grid = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: false,
  });
  const header = grid[0] ?? [];
  const columns = {name: -1, rollNo: -1, parentName: -1, parentPhone: -1};
  header.forEach((cell, index) => {
    const key = headerKey(cellText(cell));
    if (columns.name < 0 && NAME_HEADERS.has(key)) columns.name = index;
    else if (columns.rollNo < 0 && ROLL_HEADERS.has(key)) columns.rollNo = index;
    else if (columns.parentName < 0 && PARENT_HEADERS.has(key)) columns.parentName = index;
    else if (columns.parentPhone < 0 && PHONE_HEADERS.has(key)) columns.parentPhone = index;
  });
  if (columns.name < 0) throw new Error('The first row must include a Name column.');

  const rows: StudentSheetRow[] = [];
  for (let index = 1; index < grid.length; index++) {
    const line = grid[index] ?? [];
    const row: StudentSheetRow = {
      row: index + 1,
      name: cellText(line[columns.name]),
      rollNo: columns.rollNo < 0 ? '' : cellText(line[columns.rollNo]),
      parentName: columns.parentName < 0 ? '' : cellText(line[columns.parentName]),
      parentPhone: columns.parentPhone < 0 ? '' : cellText(line[columns.parentPhone]),
    };
    if (!row.name && !row.rollNo && !row.parentName && !row.parentPhone) continue;
    rows.push(row);
  }
  if (rows.length === 0) throw new Error('The file has no students.');
  if (rows.length > MAX_ROWS) throw new Error(`Upload at most ${MAX_ROWS} students at a time.`);
  return rows;
}
