import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

function loadEnvFile() {
  const envPaths = [
    path.join(__dirname, '../.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'apps/backend/.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (key && !process.env[key]) {
            process.env[key] = val;
          }
        }
      }
      break;
    }
  }
}

loadEnvFile();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/rre_db';

async function cleanData() {
  console.log('\n==========================================================================');
  console.log('  REVENUE RECOVERY ENGINE — LOCAL DATABASE & SYSTEM CLEANUP SCRIPT');
  console.log('==========================================================================');

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('  ✓ Connected to PostgreSQL database (rre_db)');

    await client.query(`
      TRUNCATE TABLE recovery_opportunities, webhook_events, recovery_payments, audit_events CASCADE;
    `);

    console.log('  ✓ Truncated local tables: recovery_opportunities, webhook_events, recovery_payments, audit_events');

    await client.end();

    console.log('\n==========================================================================');
    console.log('  SYSTEM CLEANUP COMPLETE: All local opportunities & metrics reset to 0.');
    console.log('  Open your local dashboard (http://localhost:5173) and click REFRESH!');
    console.log('==========================================================================\n');
  } catch (err: any) {
    console.error(`  ✗ Database Cleanup Error: ${err.message}`);
    process.exit(1);
  }
}

cleanData();
