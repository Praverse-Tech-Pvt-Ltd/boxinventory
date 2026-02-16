// Test script to check if challan cancellation is working
// Usage: node testCancel.js <localStorageToken> <challanId>

const challanId = process.argv[2];
const token = process.argv[3];

if (!challanId || !token) {
  console.log('Usage: node testCancel.js <challanId> <token>');
  console.log('\nExample:');
  console.log('  node testCancel.js 507f1f77bcf86cd799439011 "your-jwt-token"');
  process.exit(1);
}

const baseURL = 'http://localhost:5000';

fetch(`${baseURL}/api/challans/${challanId}/cancel`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    reason: 'Test cancellation via script'
  })
})
.then(res => {
  console.log('Response Status:', res.status, res.statusText);
  console.log('Response Headers:', {
    contentType: res.headers.get('content-type'),
    // ... other headers if needed
  });
  return res.json();
})
.then(data => {
  console.log('\nResponse Data:');
  console.log(JSON.stringify(data, null, 2));
})
.catch(error => {
  console.error('Error:', error.message);
});
