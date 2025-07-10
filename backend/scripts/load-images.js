const fs = require('fs');
const path = require('path');
const database = require('../src/models/database');

// Configuration
const IMAGE_SOURCE_DIR = '/Users/dyst/Downloads/archive 2/train';
const IMAGE_DEST_DIR = path.join(__dirname, '../public/images');
const MAX_IMAGES = 10; // Start with 10 images for testing

function copyImages() {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(IMAGE_DEST_DIR)) {
    fs.mkdirSync(IMAGE_DEST_DIR, { recursive: true });
  }

  // Get image files from source directory
  const files = fs.readdirSync(IMAGE_SOURCE_DIR)
    .filter(file => file.toLowerCase().match(/\.(jpg|jpeg|png)$/))
    .slice(0, MAX_IMAGES);

  console.log(`Found ${files.length} image files to process...`);

  const copiedImages = [];

  files.forEach(filename => {
    const srcPath = path.join(IMAGE_SOURCE_DIR, filename);
    const destPath = path.join(IMAGE_DEST_DIR, filename);
    
    try {
      fs.copyFileSync(srcPath, destPath);
      copiedImages.push({
        filename: filename,
        original_name: filename,
        local_path: destPath,
        s3_url: `/images/${filename}` // Local serving URL
      });
      console.log(`✅ Copied: ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to copy ${filename}:`, error.message);
    }
  });

  return copiedImages;
}

function insertImagesIntoDatabase(images) {
  return new Promise((resolve, reject) => {
    let completed = 0;
    let successful = 0;
    const imageIds = [];

    images.forEach(image => {
      const query = `
        INSERT INTO images (filename, s3_url, original_name, dataset_name, metadata)
        VALUES (?, ?, ?, ?, ?)
      `;

      const metadata = JSON.stringify({
        source: 'local_dataset',
        copied_from: IMAGE_SOURCE_DIR,
        file_size: fs.statSync(path.join(IMAGE_DEST_DIR, image.filename)).size
      });

      database.getDb().run(query, [
        image.filename,
        image.s3_url,
        image.original_name,
        'KSS_Training_Dataset',
        metadata
      ], function(err) {
        completed++;
        
        if (!err) {
          successful++;
          imageIds.push(this.lastID);
          console.log(`✅ Added to DB: ${image.filename} (ID: ${this.lastID})`);
        } else {
          console.error(`❌ DB error for ${image.filename}:`, err.message);
        }

        if (completed === images.length) {
          console.log(`\n📊 Database insertion complete:`);
          console.log(`   Total processed: ${completed}`);
          console.log(`   Successfully added: ${successful}`);
          console.log(`   Image IDs: ${imageIds.join(', ')}`);
          resolve(imageIds);
        }
      });
    });
  });
}

function assignImagesToScorer(imageIds, userId = 2) {
  return new Promise((resolve, reject) => {
    let completed = 0;
    let successful = 0;

    console.log(`\n🎯 Assigning ${imageIds.length} images to scorer (user ID: ${userId})...`);

    imageIds.forEach(imageId => {
      const query = `
        INSERT INTO assignments (user_id, image_id, status)
        VALUES (?, ?, 'pending')
      `;

      database.getDb().run(query, [userId, imageId], function(err) {
        completed++;
        
        if (!err) {
          successful++;
          console.log(`✅ Assigned image ${imageId} to scorer`);
        } else {
          console.error(`❌ Assignment error for image ${imageId}:`, err.message);
        }

        if (completed === imageIds.length) {
          console.log(`\n🎉 Assignment complete:`);
          console.log(`   Total assignments: ${completed}`);
          console.log(`   Successful: ${successful}`);
          resolve(successful);
        }
      });
    });
  });
}

async function main() {
  try {
    console.log('🚀 Starting KSS Dataset Import...\n');
    
    // Step 1: Copy images from source to public directory
    console.log('📁 Step 1: Copying images...');
    const images = copyImages();
    
    if (images.length === 0) {
      console.log('❌ No images found or copied. Exiting.');
      return;
    }

    // Step 2: Insert images into database
    console.log('\n💾 Step 2: Adding images to database...');
    const imageIds = await insertImagesIntoDatabase(images);

    // Step 3: Assign images to scorer
    console.log('\n👤 Step 3: Assigning images to scorer...');
    await assignImagesToScorer(imageIds);

    console.log('\n🎉 SUCCESS! Your KSS dataset is ready for scoring!');
    console.log('\n📋 What you can do now:');
    console.log('   1. Login as scorer (scorer1 / scorer123)');
    console.log('   2. Go to "Score Images" to see the rating interface');
    console.log('   3. Score some images with explanations');
    console.log('   4. Login as admin to see progress and analytics');
    console.log('\n🌐 Frontend: http://localhost:3000');
    console.log('🔧 Backend: http://localhost:3001');

  } catch (error) {
    console.error('❌ Import failed:', error);
  }
}

// Run the import
main(); 