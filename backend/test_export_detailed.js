const axios = require('axios');

async function testExport() {
  try {
    // Login first
    console.log('Logging in as admin...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('Login successful!');
    const token = loginResponse.data.token;
    
    // Test Excel export
    console.log('\nTesting Excel export...');
    try {
      const exportResponse = await axios.get('http://localhost:3001/api/admin/export/excel', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob'
      });
      
      console.log('Excel export SUCCESS!');
      console.log('Response status:', exportResponse.status);
      console.log('Response headers:', exportResponse.headers);
      console.log('Data size:', exportResponse.data.size || exportResponse.data.length || 'unknown');
      
      // Save the file to test
      const fs = require('fs');
      fs.writeFileSync('test_export.xlsx', exportResponse.data);
      console.log('File saved as test_export.xlsx');
      
    } catch (exportError) {
      console.error('Excel export ERROR:');
      console.error('Status:', exportError.response?.status);
      console.error('Status text:', exportError.response?.statusText);
      console.error('Headers:', exportError.response?.headers);
      
      if (exportError.response?.data) {
        if (typeof exportError.response.data === 'string') {
          console.error('Error data:', exportError.response.data);
        } else if (exportError.response.data.constructor === ArrayBuffer) {
          const text = new TextDecoder().decode(exportError.response.data);
          console.error('Error data (decoded):', text);
        } else {
          console.error('Error data:', exportError.response.data);
        }
      }
      console.error('Error message:', exportError.message);
    }
    
    // Test JSON export (will fail without OpenAI key but test endpoint)
    console.log('\nTesting JSON export endpoint (will fail without OpenAI key)...');
    try {
      const jsonResponse = await axios.post('http://localhost:3001/api/admin/export/llm-json', {
        apiKey: 'test-key',
        sampleFormat: JSON.stringify({ test: true }),
        includeExplanations: true
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('JSON export unexpected success:', jsonResponse.status);
      
    } catch (jsonError) {
      console.log('JSON export expected error:');
      console.log('Status:', jsonError.response?.status);
      console.log('Error message:', jsonError.response?.data?.error || jsonError.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Full error:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testExport(); 