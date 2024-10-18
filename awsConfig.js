// awsConfig.js

const AWS = require('aws-sdk');

// Load environment variables from .env file
require('dotenv').config();

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID, // Use environment variable
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // Use environment variable
    region: 'ap-southeast-2', // Your S3 bucket region
});

const s3 = new AWS.S3();
module.exports = s3;
