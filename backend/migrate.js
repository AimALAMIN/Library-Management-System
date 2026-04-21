const pool = require('./db');
async function migrate() {
  try {
    await pool.query("ALTER TABLE issued_books DROP CONSTRAINT IF EXISTS issued_books_status_check");
    await pool.query("ALTER TABLE issued_books ADD CONSTRAINT issued_books_status_check CHECK (status IN ('pending', 'issued', 'return_pending', 'returned'))");
    console.log('Constraint updated successfully');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
migrate();
