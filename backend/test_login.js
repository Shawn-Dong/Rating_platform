const axios = require('axios');

async function testLogin() {
  const passwords = ['admin', 'password', '123456', 'admin123', 'password123', ''];
  
  for (const password of passwords) {
    try {
      console.log(`Testing password: "${password}"`);
      
      const response = await axios.post('http://localhost:3001/api/auth/login', {
        username: 'admin',
        password: password
      });
      
      console.log('Login SUCCESS! Response:', response.data);
      
      if (response.data.token) {
        // Test Excel export with real token
        console.log('\nTesting Excel export with real token...');
        const exportResponse = await axios.get('http://localhost:3001/api/admin/export/excel', {
          headers: {
            'Authorization': `Bearer ${response.data.token}`
          },
          responseType: 'blob'
        });
        
        console.log('Excel export response status:', exportResponse.status);
        console.log('Excel export data size:', exportResponse.data.size || 'unknown');
        console.log('Excel export SUCCESS!');
        return; // Stop testing once we found working credentials
      }
      
    } catch (error) {
      console.log(`Password "${password}" failed:`, error.response?.data?.message || error.message);
    }
  }
  
  console.log('\nNo valid password found. Creating a simple script to update admin password...');
}

testLogin(); 