// src/db/seed.js — Development database seeder with demo accounts & sample listings
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function seed() {
  console.log('🌱 Seeding Campus Exchange database with demo data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create default admin account
    const adminPasswordHash = await bcrypt.hash('Admin@123', 12);
    const studentPasswordHash = await bcrypt.hash('Student@123', 12);

    const adminRes = await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, verified, status, department, study_year)
       VALUES ('Admin Campus', 'admin@university.edu', $1, 'ADMIN', TRUE, 'ACTIVE', 'Administration', 'Faculty')
       ON CONFLICT (email) DO UPDATE SET role = 'ADMIN', verified = TRUE
       RETURNING id`,
      [adminPasswordHash]
    );
    const adminId = adminRes.rows[0].id;

    // 2. Create student accounts
    const student1Res = await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, verified, status, department, course, study_year)
       VALUES ('Rahul Sharma', 'rahul.sharma@university.edu', $1, 'USER', TRUE, 'ACTIVE', 'Computer Science', 'B.Tech CSE', '3rd Year')
       ON CONFLICT (email) DO UPDATE SET verified = TRUE
       RETURNING id`,
      [studentPasswordHash]
    );
    const student1Id = student1Res.rows[0].id;

    const student2Res = await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, verified, status, department, course, study_year)
       VALUES ('Priya Patel', 'priya.patel@university.edu', $1, 'USER', TRUE, 'ACTIVE', 'Electronics & Comm.', 'B.Tech ECE', '4th Year')
       ON CONFLICT (email) DO UPDATE SET verified = TRUE
       RETURNING id`,
      [studentPasswordHash]
    );
    const student2Id = student2Res.rows[0].id;

    const student3Res = await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, verified, status, department, course, study_year)
       VALUES ('Ananya Verma', 'ananya.verma@university.edu', $1, 'USER', TRUE, 'ACTIVE', 'Mechanical Eng.', 'B.Tech ME', '2nd Year')
       ON CONFLICT (email) DO UPDATE SET verified = TRUE
       RETURNING id`,
      [studentPasswordHash]
    );
    const student3Id = student3Res.rows[0].id;

    // 3. Get category IDs
    const catRows = await client.query('SELECT id, name FROM categories ORDER BY display_order ASC');
    const catMap = {};
    catRows.rows.forEach(r => { catMap[r.name] = r.id; });

    const elecCatId = catMap['Electronics and project components'] || catRows.rows[0]?.id;
    const booksCatId = catMap['Books and study materials'] || catRows.rows[1]?.id;
    const engCatId = catMap['Engineering equipment'] || catRows.rows[3]?.id;

    // 4. Create sample listings
    if (elecCatId && booksCatId) {
      await client.query(
        `INSERT INTO listings
         (seller_id, category_id, title, description, item_condition, transaction_type, qty_total, qty_available, qty_reserved, price, price_basis, status)
         VALUES
         ($1, $2, 'Arduino Uno R3 with USB Cable', 'Original Arduino Uno microcontroller board. Used for one semester IoT lab. Works perfectly, pin headers intact.', 'GOOD', 'SELL', 2, 2, 0, 350.00, 'NONE', 'AVAILABLE'),
         ($1, $3, 'Higher Engineering Mathematics - B.S. Grewal (44th Ed)', 'Standard textbook in very good condition. No pages missing, minimal pencil markings inside.', 'LIKE_NEW', 'SELL', 1, 1, 0, 420.00, 'NONE', 'AVAILABLE'),
         ($2, $2, 'Casio FX-991EX Scientific Calculator', 'ClassWiz scientific calculator for semester exams and gate prep. Available for daily or weekly rental during finals.', 'LIKE_NEW', 'RENT', 1, 1, 0, 30.00, 'PER_DAY', 'AVAILABLE'),
         ($2, $2, 'Solderless Breadboard & 65-piece Jumper Wire Kit', 'Full-size breadboard with multi-color male-to-male jumper wires. Free to borrow for senior design projects.', 'GOOD', 'LEND', 1, 1, 0, 0.00, 'NONE', 'AVAILABLE'),
         ($3, $4, 'Standard Engineering Drawing Instrument Box', 'Complete mini drafter, compass set, dividers, scale and set squares in protective case.', 'GOOD', 'SELL', 1, 1, 0, 250.00, 'NONE', 'AVAILABLE')
         ON CONFLICT DO NOTHING`,
        [student1Id, elecCatId, booksCatId, engCatId]
      );
    }

    await client.query('COMMIT');
    console.log(`
✅ Database seeding completed successfully!

Demo Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Role       Email                          Password
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Admin      admin@university.edu           Admin@123
Student    rahul.sharma@university.edu    Student@123
Student    priya.patel@university.edu     Student@123
Student    ananya.verma@university.edu    Student@123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
