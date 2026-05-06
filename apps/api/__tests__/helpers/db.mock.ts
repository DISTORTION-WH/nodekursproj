/**
 * Central mock for the pg client used across the codebase.
 * Import this file BEFORE any module that imports databasepg.
 */

const mockQuery = jest.fn();
const mockClient = { query: mockQuery };

jest.mock('../../databasepg', () => mockClient);

export { mockQuery, mockClient };

export function resetDb() {
  mockQuery.mockReset();
}

/** Helper: configure mockQuery to return rows for the next N calls */
export function dbReturns(...rows: object[][]) {
  rows.forEach((r) =>
    mockQuery.mockResolvedValueOnce({ rows: r, rowCount: r.length })
  );
}
