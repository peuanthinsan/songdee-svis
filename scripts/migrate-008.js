const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  const schema = fs.readFileSync('sql/008-indexes.sql', 'utf8');
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log('008-indexes.sql applied');
}
run();
