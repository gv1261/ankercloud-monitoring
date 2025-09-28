require('dotenv').config();
const jwt = require('jsonwebtoken');

// Replace this with your existing JWT token
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImUxOGVkMzgzLTg5MzYtNDdkYS1iYzZmLTEzZjM4OTMyNWNmNSIsImVtYWlsIjoiZGVtb0BhbmtlcmNsb3VkLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1ODAzMTIyNiwiZXhwIjoxNzU4MDM0ODI2fQ.L-HNEW2TBWp684aHEsJjWf8Iq1ySk4pcXSEQLHvUKCs";

try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log("Token is valid. Decoded payload:");
} catch (err) {
  console.log("Token verification failed:", err.message);
}
