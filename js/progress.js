export function createProgress() {
  // Initialize all tables (2-12) with speed 0
  const tables = {};
  for (let i = 2; i <= 12; i++) {
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
