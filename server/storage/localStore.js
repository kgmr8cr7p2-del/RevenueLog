import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const DATA_FILE = path.join(DATA_DIR, 'builds.json');

async function readItems() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeItems(items) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
}

export function createLocalStore() {
  return {
    type: 'local-json',

    async list() {
      return readItems();
    },

    async create(item) {
      const items = await readItems();
      items.push(item);
      await writeItems(items);
      return item;
    },

    async update(id, item) {
      const items = await readItems();
      const index = items.findIndex((candidate) => candidate.id === id);
      if (index === -1) return null;
      items[index] = item;
      await writeItems(items);
      return item;
    },

    async delete(id) {
      const items = await readItems();
      const nextItems = items.filter((candidate) => candidate.id !== id);
      if (nextItems.length === items.length) return false;
      await writeItems(nextItems);
      return true;
    }
  };
}
