require("dotenv").config();
const jwt = require("jsonwebtoken");

// Debug: print JWT_SECRET
console.log("Loaded JWT_SECRET:", process.env.JWT_SECRET);

const payload = { user: "test-user" };

const token = jwt.sign(payload, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || "10d",
});

console.log("Generated Token:", token);
