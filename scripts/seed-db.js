/**
 * Synchronizes vehicles and fleet-manager email addresses from data-vehicles.json.
 * Run safely first: node scripts/seed-db.js --dry-run
 */
const { neon } = require('@neondatabase/serverless');
const { requireConfirmedTarget } = require('./lib/db-target');
const { resolveCompany } = require('./lib/company-target');

const vehicles = require('./data-vehicles.json');
const emails = require('./data-emails.json');

const TYPE_MAP = {
  'รถยนต์': 'car',
  'Van': 'van',
  'E-Van': 'e_van',
  'E-Bike': 'e_bike',
  'มอเตอร์ไซค์': 'motorcycle',
};
const dryRun = process.argv.includes('--dry-run');

function seedVehicle(vehicle) {
  const vehicleType = TYPE_MAP[vehicle.type];
  if (!vehicleType) throw new Error(`Unmapped vehicle type ${JSON.stringify(vehicle.type)} for plate ${JSON.stringify(vehicle.plate)}`);
  return {
    plate: vehicle.plate,
    vehicleType,
    fleetId: vehicle.fleet,
    managerEmail: emails[vehicle.fleet] || null,
  };
}

function needsUpdate(current, desired) {
  return current.vehicle_type !== desired.vehicleType ||
    current.fleet_id !== desired.fleetId ||
    (desired.managerEmail !== null && current.fleet_manager_email !== desired.managerEmail) ||
    !current.is_active;
}

async function seedDb() {
  const desiredVehicles = vehicles.map(seedVehicle);
  const plates = new Set(desiredVehicles.map((vehicle) => vehicle.plate));
  if (plates.size !== desiredVehicles.length) throw new Error('data-vehicles.json contains duplicate plates');

  const url = requireConfirmedTarget({ action: `sync ${desiredVehicles.length} vehicles`, dryRun });
  const sql = neon(url);
  const company = await resolveCompany(sql);
  const existingRows = await sql`
    SELECT plate_number, vehicle_type, fleet_id, fleet_manager_email, is_active
    FROM vehicle_master
    WHERE company_id = ${company.id}
  `;
  const existing = new Map(existingRows.map((vehicle) => [vehicle.plate_number, vehicle]));
  const inserts = desiredVehicles.filter((vehicle) => !existing.has(vehicle.plate));
  const updates = desiredVehicles.filter((vehicle) => {
    const current = existing.get(vehicle.plate);
    return current && needsUpdate(current, vehicle);
  });
  const deactivations = existingRows.filter((vehicle) => vehicle.is_active && !plates.has(vehicle.plate_number));

  console.log(`Vehicle sync plan${dryRun ? ' (dry run)' : ''}:`);
  console.log(`  insert: ${inserts.length}`);
  console.log(`  update: ${updates.length}`);
  console.log(`  deactivate: ${deactivations.length}`);
  for (const vehicle of deactivations) console.log(`  deactivate plate: ${vehicle.plate_number}`);
  console.log(`  unchanged: ${desiredVehicles.length - inserts.length - updates.length}`);
  console.log(`  source vehicles: ${desiredVehicles.length} (company: ${company.slug})`);
  console.log(`  fleets without fleet_manager_email: ${[...new Set(desiredVehicles.filter((vehicle) => !vehicle.managerEmail).map((vehicle) => vehicle.fleetId))].sort().join(', ')}`);

  if (dryRun) {
    console.log('Dry run complete; no writes performed.');
    return;
  }

  for (const vehicle of [...inserts, ...updates]) {
    await sql`
      INSERT INTO vehicle_master (company_id, plate_number, vehicle_type, fleet_id, fleet_manager_email, region, is_active)
      VALUES (${company.id}, ${vehicle.plate}, ${vehicle.vehicleType}, ${vehicle.fleetId}, ${vehicle.managerEmail}, 'metro', true)
      ON CONFLICT (company_id, plate_number) DO UPDATE SET
        vehicle_type = EXCLUDED.vehicle_type,
        fleet_id = EXCLUDED.fleet_id,
        fleet_manager_email = COALESCE(EXCLUDED.fleet_manager_email, vehicle_master.fleet_manager_email),
        is_active = true
    `;
  }
  for (const vehicle of deactivations) {
    await sql`UPDATE vehicle_master SET is_active = false WHERE company_id = ${company.id} AND plate_number = ${vehicle.plate_number}`;
  }

  console.log(`Vehicle sync complete: ${inserts.length} inserted, ${updates.length} updated, ${deactivations.length} deactivated.`);
}

seedDb().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
