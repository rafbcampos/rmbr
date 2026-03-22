#!/usr/bin/env bun

import { runCli } from '../src/cli.ts';
import { runMcp } from '../src/mcp.ts';
import { RmbrError } from '../src/core/errors.ts';

const args = process.argv.slice(2);

try {
  if (args[0] === 'mcp') {
    await runMcp();
  } else {
    await runCli();
  }
} catch (error: unknown) {
  if (error instanceof RmbrError) {
    console.error(`Error [${error.code}]: ${error.message}`);
    process.exit(1);
  }
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('An unexpected error occurred');
  }
  process.exit(1);
}
