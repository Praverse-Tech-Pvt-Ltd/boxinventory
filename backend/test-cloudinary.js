import dotenv from 'dotenv';

// Configure dotenv FIRST before importing cloudinary config
dotenv.config();

import cloudinary from './config/cloudinaryConfig.js';

// Test Cloudinary configuration
async function testCloudinary() {
  try {
    console.log('Testing Cloudinary configuration...\n');
    
    // Check if environment variables are set
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    
    if (!cloudName || !apiKey || !apiSecret) {
      console.error('❌ Error: Missing Cloudinary environment variables!');
      console.log('\nRequired environment variables:');
      console.log('- CLOUDINARY_CLOUD_NAME');
      console.log('- CLOUDINARY_API_KEY');
      console.log('- CLOUDINARY_API_SECRET');
      console.log('\nPlease check your .env file.');
      process.exit(1);
    }
    
    console.log('✅ Environment variables found:');
    console.log(`   Cloud Name: ${cloudName}`);
    console.log(`   API Key: ${apiKey.substring(0, 8)}...`);
    console.log(`   API Secret: ${apiSecret.substring(0, 8)}...`);
    console.log('\nTesting Cloudinary connection...\n');
    
    // First, verify the configuration object
    const config = cloudinary.config();
    console.log('Cloudinary Config Status:');
    console.log(`   Cloud Name: ${config.cloud_name || 'Not set'}`);
    console.log(`   API Key: ${config.api_key ? config.api_key.substring(0, 8) + '...' : 'Not set'}`);
    console.log(`   API Secret: ${config.api_secret ? 'Set (hidden)' : 'Not set'}\n`);
    
    // Test upload capability with a simple test
    console.log('Testing upload capability...');
    try {
      // Create a simple test image (1x1 pixel transparent PNG in base64)
      const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      console.log('   Attempting to upload test image...');
      const uploadResult = await cloudinary.uploader.upload(testImage, {
        folder: 'eraya-ratna-products',
        public_id: 'test-connection',
        overwrite: true,
      });
      
      console.log('✅ Cloudinary connection successful!');
      console.log('✅ Test upload successful!');
      console.log(`   Uploaded to: ${uploadResult.secure_url}`);
      console.log(`   Public ID: ${uploadResult.public_id}`);
      
      // Clean up test image
      console.log('   Cleaning up test image...');
      await cloudinary.uploader.destroy('eraya-ratna-products/test-connection');
      console.log('✅ Test image cleaned up.\n');
      
      console.log('🎉 All tests passed! Cloudinary is properly configured.');
      console.log('✅ Your Cloudinary setup is ready to use with the box controller.\n');
    } catch (uploadError) {
      console.error('❌ Upload test failed!');
      console.error('   Error Type:', uploadError.constructor.name);
      console.error('   Error Message:', uploadError.message || 'No message');
      if (uploadError.error) {
        console.error('   Error Details:', uploadError.error);
      }
      if (uploadError.http_code) {
        console.error(`   HTTP Code: ${uploadError.http_code}`);
      }
      if (uploadError.name) {
        console.error(`   Error Name: ${uploadError.name}`);
      }
      
      // Try to get more details
      try {
        const errorStr = JSON.stringify(uploadError, Object.getOwnPropertyNames(uploadError));
        if (errorStr !== '{}') {
          console.error('   Full Error:', errorStr);
        }
      } catch (e) {
        // Ignore JSON stringify errors
      }
      
      if (uploadError.http_code === 401) {
        console.error('\n⚠️  Authentication failed. Please verify your API credentials in .env file.');
        console.error('   Make sure CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are correct.');
      } else if (uploadError.http_code === 400) {
        console.error('\n⚠️  Bad request. Please check your Cloudinary configuration.');
      } else if (!uploadError.http_code) {
        console.error('\n⚠️  Connection issue. Please check:');
        console.error('   1. Your internet connection');
        console.error('   2. Cloudinary service status');
        console.error('   3. Firewall/proxy settings');
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error testing Cloudinary:');
    console.error('   Message:', error.message || error.toString());
    console.error('   Full error:', JSON.stringify(error, null, 2));
    if (error.http_code === 401) {
      console.error('\n⚠️  Authentication failed. Please check your API credentials.');
    }
    process.exit(1);
  }
}

testCloudinary();
