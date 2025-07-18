const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixDaylightSavings() {
  try {
    console.log('🔄 Fixing daylight savings time for jobs 1-449...');

    // Update job created_at times
    const jobResult = await pool.query(`
      UPDATE jobs 
      SET created_at = created_at - INTERVAL '1 hour'
      WHERE id >= 1 AND id <= 449
      RETURNING id, created_at
    `);

    console.log(`✅ Updated ${jobResult.rows.length} job created_at times`);

    // Update time entry clock_in_time and clock_out_time
    const timeEntryResult = await pool.query(`
      UPDATE time_entries 
      SET 
        clock_in_time = clock_in_time - INTERVAL '1 hour',
        clock_out_time = clock_out_time - INTERVAL '1 hour'
      WHERE job_id >= 1 AND job_id <= 449
      RETURNING id, job_id, clock_in_time, clock_out_time
    `);

    console.log(`✅ Updated ${timeEntryResult.rows.length} time entry clock times`);

    // Show some examples of the changes
    console.log('\n📋 Examples of updated times:');
    
    const examples = await pool.query(`
      SELECT 
        j.id as job_id,
        j.created_at as job_created_at,
        te.clock_in_time,
        te.clock_out_time
      FROM jobs j
      LEFT JOIN time_entries te ON j.id = te.job_id
      WHERE j.id IN (1, 100, 200, 300, 449)
      ORDER BY j.id
    `);

    examples.rows.forEach(row => {
      console.log(`Job ${row.job_id}: created_at = ${row.job_created_at}`);
      if (row.clock_in_time) {
        console.log(`  Time entry: ${row.clock_in_time} to ${row.clock_out_time}`);
      }
    });

    console.log('\n✅ Daylight savings time fix completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing daylight savings time:', error);
  } finally {
    await pool.end();
  }
}

fixDaylightSavings(); 