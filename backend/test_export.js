const jwt = require('jsonwebtoken');
const axios = require('axios');

const JWT_SECRET = 'kss-rating-platform-secret-key-2024';

// Generate admin token
const adminUser = {
  id: 1,
  username: 'admin',
  email: 'admin@kss.com',
  role: 'admin'
};

const token = jwt.sign(adminUser, JWT_SECRET, { expiresIn: '1h' });

console.log('Generated admin token:', token);

// Test Excel export
async function testExcelExport() {
  try {
    console.log('\nTesting Excel export...');
    const response = await axios.get('http://localhost:3001/api/admin/export/excel', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      responseType: 'blob'
    });
    
    console.log('Excel export response status:', response.status);
    console.log('Excel export response headers:', response.headers);
    console.log('Excel export data size:', response.data.size || 'unknown');
    console.log('Excel export SUCCESS!');
    
  } catch (error) {
    console.error('Excel export ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Test LLM JSON export
async function testLLMExport() {
  try {
    console.log('\nTesting LLM JSON export...');
    const sampleFormat = {
      "metadata": {
        "export_date": "2024-01-15",
        "total_images": 0,
        "total_scores": 0
      },
      "images": [
        {
          "filename": "image_001.jpg",
          "original_name": "sample_image.jpg",
          "dataset": "drowsiness_study_2024",
          "scores": [
            {
              "scorer": "user123",
              "kss_score": 5,
              "explanation": "Person shows moderate signs of sleepiness...",
              "time_spent": 45,
              "scored_date": "2024-01-15T10:30:00Z"
            }
          ]
        }
      ]
    };
    
    const response = await axios.post('http://localhost:3001/api/admin/export/llm-json', {
      apiKey: 'fake-key-for-testing', // This will fail but test the endpoint
      sampleFormat: JSON.stringify(sampleFormat),
      includeExplanations: true
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      responseType: 'blob'
    });
    
    console.log('LLM export response status:', response.status);
    console.log('LLM export SUCCESS!');
    
  } catch (error) {
    console.error('LLM export ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      if (error.response.data && error.response.data.text) {
        const text = await error.response.data.text();
        console.error('Response data:', text);
      }
    }
  }
}

// Run tests
async function runTests() {
  await testExcelExport();
  await testLLMExport();
}

runTests(); 