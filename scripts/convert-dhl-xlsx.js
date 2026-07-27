/**
 * Convert DHL's customer workbook into the two seed-data files.
 *
 * Usage: node scripts/convert-dhl-xlsx.js "/path/to/DHL Express_data.xlsx"
 *
 * Cleanup is intentionally performed here, not in the database seeds, so the
 * generated JSON files are an auditable representation of the import set.
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const USER_SHEET = 'User_Pw_Role';
const VEHICLE_SHEET = 'Vehicle Master';

function cellText(row, column) {
  return String(row.getCell(column).text || '').trim();
}

function columnNumbers(sheet, expectedHeaders) {
  const headers = new Map();
  sheet.getRow(1).eachCell((cell, column) => headers.set(String(cell.text).trim(), column));
  const columns = {};
  for (const header of expectedHeaders) {
    const column = headers.get(header);
    if (!column) throw new Error(`Sheet "${sheet.name}" is missing required column "${header}"`);
    columns[header] = column;
  }
  return columns;
}

function normalizedName(name) {
  return name.toLowerCase().replace(/\s+/g, '');
}

function roleRank(role) {
  if (/^Admin\s*-\s*CO$/i.test(role)) return 3;
  if (/^Admin\s*-\s*/i.test(role)) return 2;
  return 1;
}

function spacedName(records) {
  return records.reduce((best, record) => {
    const bestSpaces = (best.name.match(/\s/g) || []).length;
    const recordSpaces = (record.name.match(/\s/g) || []).length;
    return recordSpaces > bestSpaces ? record : best;
  }).name;
}

function printExclusion(entry) {
  console.log(`  ${entry.kind} row ${entry.row}: ${entry.reason} — ${entry.values}`);
}

async function convert(inputPath) {
  if (!inputPath) throw new Error('Usage: node scripts/convert-dhl-xlsx.js "/path/to/DHL Express_data.xlsx"');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);

  const userSheet = workbook.getWorksheet(USER_SHEET);
  const vehicleSheet = workbook.getWorksheet(VEHICLE_SHEET);
  if (!userSheet || !vehicleSheet) {
    throw new Error(`Expected sheets "${USER_SHEET}" and "${VEHICLE_SHEET}"`);
  }

  const userColumns = columnNumbers(userSheet, ['UserID', 'PW', 'Fleet', 'Role']);
  const vehicleColumns = columnNumbers(vehicleSheet, ['Vehicle No', 'Vehicle Type', 'Fleet']);
  const exclusions = [];

  const userGroups = new Map();
  for (let rowNumber = 2; rowNumber <= userSheet.rowCount; rowNumber++) {
    const row = userSheet.getRow(rowNumber);
    const name = cellText(row, userColumns.UserID);
    const password = cellText(row, userColumns.PW);
    const fleet = cellText(row, userColumns.Fleet);
    const role = cellText(row, userColumns.Role);
    if (!name && !password && !fleet && !role) continue;

    const values = `UserID=${JSON.stringify(name)}, Fleet=${JSON.stringify(fleet)}, Role=${JSON.stringify(role)}`;
    if (!fleet) {
      exclusions.push({ kind: 'SKIP user', row: rowNumber, reason: 'blank Fleet', values });
      continue;
    }
    if (name === 'TBD' && password === 'TBD') {
      exclusions.push({ kind: 'SKIP user', row: rowNumber, reason: 'TBD placeholder', values });
      continue;
    }

    const record = { name, fleet, role, row: rowNumber };
    const key = normalizedName(name);
    const group = userGroups.get(key) || [];
    group.push(record);
    userGroups.set(key, group);
  }

  const users = [];
  for (const records of userGroups.values()) {
    const winner = records.reduce((best, record) => roleRank(record.role) > roleRank(best.role) ? record : best);
    const name = spacedName(records);
    users.push({ name, fleet: winner.fleet, role: winner.role });
    for (const record of records) {
      if (record === winner && records.length === 1) continue;
      if (record !== winner || record.name !== name) {
        exclusions.push({
          kind: 'MERGE user',
          row: record.row,
          reason: `space-collapsed duplicate of ${JSON.stringify(name)}; kept ${JSON.stringify(name)} with role ${JSON.stringify(winner.role)}`,
          values: `UserID=${JSON.stringify(record.name)}, Fleet=${JSON.stringify(record.fleet)}, Role=${JSON.stringify(record.role)}`,
        });
      }
    }
  }

  const vehicles = [];
  const plates = new Set();
  for (let rowNumber = 2; rowNumber <= vehicleSheet.rowCount; rowNumber++) {
    const row = vehicleSheet.getRow(rowNumber);
    const plate = cellText(row, vehicleColumns['Vehicle No']);
    const type = cellText(row, vehicleColumns['Vehicle Type']);
    const fleet = cellText(row, vehicleColumns.Fleet);
    if (!plate && !type && !fleet) continue;

    const values = `Vehicle No=${JSON.stringify(plate)}, Vehicle Type=${JSON.stringify(type)}, Fleet=${JSON.stringify(fleet)}`;
    if (plates.has(plate)) {
      exclusions.push({ kind: 'MERGE vehicle', row: rowNumber, reason: `duplicate plate ${JSON.stringify(plate)}; kept first occurrence`, values });
      continue;
    }
    plates.add(plate);
    vehicles.push({ plate, type, fleet });
  }

  fs.writeFileSync(path.join(__dirname, 'data-users.json'), `${JSON.stringify(users, null, 2)}\n`);
  fs.writeFileSync(path.join(__dirname, 'data-vehicles.json'), `${JSON.stringify(vehicles, null, 2)}\n`);

  console.log(`Converted ${path.resolve(inputPath)}`);
  console.log(`Users: ${users.length}; vehicles: ${vehicles.length}`);
  console.log('Exclusion report:');
  exclusions.forEach(printExclusion);

}

convert(process.argv[2]).catch((error) => {
  console.error(`Conversion failed: ${error.message}`);
  process.exit(1);
});
