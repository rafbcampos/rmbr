import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { Command } from 'commander';
import { loadConfig } from './core/config.ts';
import { openDrizzleDatabase } from './core/db.ts';
import { runMigrations } from './core/migrator.ts';
import { createAppRegistry } from './registry.ts';

const SKILL_PREFIX = 'rmbr-';

interface SkillMetadata {
  readonly name: string;
  readonly description: string;
  readonly filePath: string;
}

function getSkillsDir(): string {
  return resolve(dirname(import.meta.path), 'skills');
}

function listBundledSkills(): readonly SkillMetadata[] {
  const skillsDir = getSkillsDir();
  if (!existsSync(skillsDir)) {
    return [];
  }
  const entries = readdirSync(skillsDir, { withFileTypes: true });
  const skills: SkillMetadata[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = join(skillsDir, entry.name, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    const content = readFileSync(skillFile, 'utf-8');
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const descMatch = content.match(/^description:\s*['"]?(.+?)['"]?\s*$/m);

    skills.push({
      name: nameMatch?.[1] !== undefined ? nameMatch[1].trim() : entry.name,
      description: descMatch?.[1] !== undefined ? descMatch[1].trim() : '',
      filePath: skillFile,
    });
  }

  return skills;
}

function getInstallDir(local: boolean): string {
  if (local) {
    return resolve(process.cwd(), '.claude', 'commands');
  }
  const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '';
  return join(home, '.claude', 'commands');
}

function registerSkillCommands(program: Command): void {
  const skill = program.command('skill').description('Manage rmbr skills for Claude Code');

  skill
    .command('list')
    .description('List all bundled skills')
    .action(() => {
      const skills = listBundledSkills();
      if (skills.length === 0) {
        console.log('No bundled skills found.');
        return;
      }
      console.log('Available skills:\n');
      for (const s of skills) {
        console.log(`  ${s.name}`);
        console.log(`    ${s.description}\n`);
      }
    });

  skill
    .command('show')
    .description("Show a skill's content")
    .argument('<name>', 'Skill name')
    .action((name: string) => {
      const skills = listBundledSkills();
      const found = skills.find(s => s.name === name);
      if (!found) {
        console.error(`Skill '${name}' not found. Run 'rmbr skill list' to see available skills.`);
        process.exit(1);
      }
      console.log(readFileSync(found.filePath, 'utf-8'));
    });

  skill
    .command('install')
    .description('Install skills into Claude Code as slash commands')
    .argument('[name]', 'Install a specific skill (omit for all)')
    .option('--local', 'Install to project .claude/commands/ instead of global')
    .action((name: string | undefined, opts: { local?: boolean }) => {
      const skills = listBundledSkills();
      const toInstall = name ? skills.filter(s => s.name === name) : [...skills];

      if (toInstall.length === 0) {
        console.error(
          name
            ? `Skill '${name}' not found. Run 'rmbr skill list' to see available skills.`
            : 'No bundled skills found.',
        );
        process.exit(1);
      }

      const targetDir = getInstallDir(opts.local === true);
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      for (const s of toInstall) {
        const content = readFileSync(s.filePath, 'utf-8');
        const targetFile = join(targetDir, `${SKILL_PREFIX}${s.name}.md`);
        writeFileSync(targetFile, content, 'utf-8');
        console.log(`Installed ${s.name} → ${targetFile}`);
      }

      console.log(
        `\n${toInstall.length} skill(s) installed. Use /${SKILL_PREFIX}<name> in Claude Code.`,
      );
    });

  skill
    .command('uninstall')
    .description('Remove rmbr skills from Claude Code')
    .option('--local', 'Remove from project .claude/commands/ instead of global')
    .action((opts: { local?: boolean }) => {
      const targetDir = getInstallDir(opts.local === true);
      if (!existsSync(targetDir)) {
        console.log('No skills installed.');
        return;
      }

      const files = readdirSync(targetDir).filter(
        f => f.startsWith(SKILL_PREFIX) && f.endsWith('.md'),
      );

      if (files.length === 0) {
        console.log('No rmbr skills found to uninstall.');
        return;
      }

      for (const f of files) {
        unlinkSync(join(targetDir, f));
        console.log(`Removed ${f}`);
      }

      console.log(`\n${files.length} skill(s) uninstalled.`);
    });
}

export async function runCli(): Promise<void> {
  const program = new Command();
  program.name('rmbr').description('CLI second brain for work').version('0.1.0');

  const config = loadConfig();
  const { raw, drizzle: db } = openDrizzleDatabase(config.dbPath);
  const registry = createAppRegistry();

  runMigrations(raw, registry.getAllMigrations());

  for (const mod of registry.getModules()) {
    mod.registerCommands(program, db);
  }

  registerSkillCommands(program);

  await program.parseAsync(process.argv);
}
