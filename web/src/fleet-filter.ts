const FLEET_FILTER_PATHS = new Set(['/', '/inspections', '/issues', '/history']);

export function supportsFleetFilter(pathname: string) {
  const normalizedPath = pathname === '/' ? pathname : pathname.replace(/\/+$/, '');
  return FLEET_FILTER_PATHS.has(normalizedPath);
}

export function fleetIdsFromRows(rows: Array<{ fleet_id: string }>) {
  return Array.from(new Set(
    rows.map((row) => row.fleet_id).filter((fleetId) => fleetId.length > 0),
  )).sort((a, b) => a.localeCompare(b));
}

export function resolveFleetScope(
  isAdmin: boolean,
  assignedFleet: string | undefined,
  selectedFleet: string | undefined,
) {
  return isAdmin ? selectedFleet : (assignedFleet || undefined);
}
