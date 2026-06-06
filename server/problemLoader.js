import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROBLEMS_DIR = path.join(__dirname, 'problems');

export function getAllProblems() {
  const files = fs.readdirSync(PROBLEMS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const raw = fs.readFileSync(path.join(PROBLEMS_DIR, f), 'utf-8');
    const problem = JSON.parse(raw);
    return {
      id: problem.id,
      title: problem.title,
      category: problem.category,
    };
  });
}

export function getProblem(id) {
  const filePath = path.join(PROBLEMS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  }

  const files = fs.readdirSync(PROBLEMS_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(PROBLEMS_DIR, file), 'utf-8');
    const problem = JSON.parse(raw);
    if (problem.id === id) {
      return problem;
    }
  }

  return null;
}
