import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  out: './drizzle',
  schema: './src/modules/*/drizzle-schema.ts',
});
