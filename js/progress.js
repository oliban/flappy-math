import { MIN_TABLE, MAX_TABLE } from './constants.js';

export function createProgress() {
  // Initialize every playable table with speed 0
  const tables = {};
  for (let i = MIN_TABLE; i <= MAX_TABLE; i++) {
    tables[i] = 0;
  }

  return {
    getBestSpeed(table) {
      return tables[table] || 0;
    },

    updateBestSpeed(table, speed) {
      if (speed > (tables[table] || 0)) {
        tables[table] = speed;
      }
    },

    getAllProgress() {
      return { ...tables };
    },

    export() {
      return { tables: { ...tables } };
    },

    import(data) {
      if (data && data.tables) {
        Object.entries(data.tables).forEach(([table, speed]) => {
          tables[parseInt(table)] = speed;
        });
      }
    }
  };
}
