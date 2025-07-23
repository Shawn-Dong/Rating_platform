const database = require('../models/database');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
  console.log('🚀 Initializing KSS Rating Platform Database...\n');

  try {
    // Wait for database connection
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });

    console.log('📊 Creating default admin user...');
    
    // Create default admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    database.getDb().run(`
      INSERT OR IGNORE INTO users (username, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?)
    `, ['admin', 'admin@kss-platform.com', adminPassword, 'admin', 1], function(err) {
      if (err) {
        console.error('❌ Error creating admin user:', err.message);
      } else {
        console.log('✅ Admin user created (username: admin, password: admin123)');
      }
    });

    console.log('👤 Creating default scorer user...');
    
    // Create default scorer user
    const scorerPassword = await bcrypt.hash('scorer123', 10);
    database.getDb().run(`
      INSERT OR IGNORE INTO users (username, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?)
    `, ['scorer1', 'scorer1@kss-platform.com', scorerPassword, 'scorer', 1], function(err) {
      if (err) {
        console.error('❌ Error creating scorer user:', err.message);
      } else {
        console.log('✅ Scorer user created (username: scorer1, password: scorer123)');
      }
    });

    // Wait a bit for the operations to complete
    setTimeout(() => {
      console.log('\n🎉 Database initialization complete!');
      console.log('\n📋 Next Steps:');
      console.log('   1. Start the backend server: npm run dev');
      console.log('   2. Start the frontend: cd ../frontend && npm start');
      console.log('   3. Login as admin to upload images and manage users');
      console.log('   4. Assign images to scorers for rating');
      console.log('\n🌐 URLs:');
      console.log('   Frontend: http://localhost:3000');
      console.log('   Backend API: http://localhost:3001');
      console.log('   Health Check: http://localhost:3001/api/health');
      
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run initialization
initializeDatabase(); 