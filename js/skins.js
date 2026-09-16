// Bird skins - the reward for beating your own local highscore.
// Skins unlock in catalog order, one per new personal best.

export const SKINS = [
  {
    id: 'classic',
    name: 'Classic',
    colors: {
      bodyLight: '#FFE566', body: '#FFD700', bodyDark: '#E5A800',
      outline: '#CC8800', wing: '#E5C100', beak: '#FF6B35', beakDark: '#CC4400'
    }
  },
  {
    id: 'ruby',
    name: 'Ruby',
    colors: {
      bodyLight: '#FF9A9A', body: '#E53935', bodyDark: '#A81E1E',
      outline: '#8E1616', wing: '#C62828', beak: '#FFB300', beakDark: '#C67C00'
    }
  },
  {
    id: 'sky',
    name: 'Sky',
    colors: {
      bodyLight: '#A5D8FF', body: '#42A5F5', bodyDark: '#1565C0',
      outline: '#0D47A1', wing: '#1E88E5', beak: '#FF8A3D', beakDark: '#D45C00'
    }
  },
  {
    id: 'mint',
    name: 'Mint',
    colors: {
      bodyLight: '#B9F6CA', body: '#4CAF50', bodyDark: '#2E7D32',
      outline: '#1B5E20', wing: '#43A047', beak: '#FFC947', beakDark: '#C79100'
    }
  },
  {
    id: 'grape',
    name: 'Grape',
    colors: {
      bodyLight: '#D9B3FF', body: '#8E44AD', bodyDark: '#5B2C6F',
      outline: '#4A235A', wing: '#7D3C98', beak: '#FFD54F', beakDark: '#C8A415'
    }
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: {
      bodyLight: '#FFCC80', body: '#FB8C00', bodyDark: '#E65100',
      outline: '#BF360C', wing: '#F4511E', beak: '#FFF176', beakDark: '#C9B037'
    }
  },
  {
    id: 'ice',
    name: 'Ice',
    colors: {
      bodyLight: '#FFFFFF', body: '#D7F1FF', bodyDark: '#8EC8E0',
      outline: '#5FA8C4', wing: '#B3E5FC', beak: '#FF7043', beakDark: '#C63F17'
    }
  },
  {
    id: 'shadow',
    name: 'Shadow',
    colors: {
      bodyLight: '#6B7280', body: '#374151', bodyDark: '#1F2937',
      outline: '#111827', wing: '#4B5563', beak: '#FBBF24', beakDark: '#B45309'
    }
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    colors: {
      bodyLight: '#FFE5F1', body: '#FF6FB5', bodyDark: '#7B2FF7',
      outline: '#5B1FB8', wing: '#38BDF8', beak: '#FACC15', beakDark: '#CA8A04'
    }
  }
];

export const DEFAULT_SKIN_ID = SKINS[0].id;

function findSkin(id) {
  return SKINS.find(skin => skin.id === id) || null;
}

export function createSkins() {
  let unlocked = new Set([DEFAULT_SKIN_ID]);
  let selectedId = DEFAULT_SKIN_ID;

  return {
    getAll() {
      return SKINS.map(skin => ({ ...skin, unlocked: unlocked.has(skin.id) }));
    },

    getUnlocked() {
      return SKINS.filter(skin => unlocked.has(skin.id)).map(skin => ({ ...skin }));
    },

    isUnlocked(id) {
      return unlocked.has(id);
    },

    unlockedCount() {
      return unlocked.size;
    },

    hasLockedSkins() {
      return unlocked.size < SKINS.length;
    },

    // Unlocks the next skin in catalog order. Returns it, or null if the player
    // already owns every skin.
    unlockNext() {
      const next = SKINS.find(skin => !unlocked.has(skin.id));
      if (!next) return null;

      unlocked.add(next.id);
      return { ...next };
    },

    getSelected() {
      return { ...(findSkin(selectedId) || SKINS[0]) };
    },

    getSelectedId() {
      return selectedId;
    },

    select(id) {
      if (!findSkin(id) || !unlocked.has(id)) return false;

      selectedId = id;
      return true;
    },

    export() {
      return { unlocked: [...unlocked], selected: selectedId };
    },

    import(data) {
      unlocked = new Set([DEFAULT_SKIN_ID]);
      selectedId = DEFAULT_SKIN_ID;

      if (!data || typeof data !== 'object') return;

      if (Array.isArray(data.unlocked)) {
        data.unlocked.forEach(id => {
          if (findSkin(id)) unlocked.add(id);
        });
      }

      if (typeof data.selected === 'string' && findSkin(data.selected) && unlocked.has(data.selected)) {
        selectedId = data.selected;
      }
    }
  };
}
