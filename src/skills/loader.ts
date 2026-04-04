import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Mode, Skill } from '../types.ts';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

function parseSkillMetadata(text: string, fallbackName: string): Skill {
  const nameMatch = text.match(/^name:\s*(.+)$/m);
  const descriptionMatch = text.match(/^description:\s*(.+)$/m);
  return {
    name: nameMatch?.[1]?.trim() || fallbackName,
    description: descriptionMatch?.[1]?.trim() || text.split('\n').slice(0, 3).join(' ').trim(),
  };
}

async function loadSkillDir(dirPath: string): Promise<Skill[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const skillFile = path.join(entryPath, 'SKILL.md');
        try {
          await stat(skillFile);
          files.push(skillFile);
        } catch {
          continue;
        }
      } else if (entry.isFile() && entry.name.toLowerCase() === 'skill.md') {
        files.push(entryPath);
      }
    }
  } catch {
    return [];
  }

  const skills: Skill[] = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const parsed = parseSkillMetadata(text, path.basename(path.dirname(file)));
    skills.push({
      name: parsed.name,
      description: parsed.description || text.split('\n').slice(0, 3).join(' ').trim(),
      file,
    });
  }
  return skills;
}

export async function loadSkillsForModes(modes: Mode[]): Promise<Skill[]> {
  const skillRoots = [...new Set(modes.flatMap(mode => mode.skillRoots ?? []))];
  const skills: Skill[] = [];
  for (const root of skillRoots) {
    const absolute = path.join(projectRoot, root);
    skills.push(...await loadSkillDir(absolute));
  }
  return skills;
}
