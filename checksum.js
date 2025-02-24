require('dotenv').config()
const crypto = require("crypto");

const secretKey = process.env.FCMB_CLIENT_SECRET; 

const payload = JSON.stringify({
  
    "amount": "1100",
    "accountNumber": "7000023418",
    "type": "STATIC",
    "senderAccountNumber": "0987654321",
    "senderAccountName": "Jane Doe",
    "senderBank": "011",
    "time": "2024-02-23T12:34:56.789Z",
    "reference": "unique-event-id-123"
  
});
  

  const computedHash = crypto.createHmac("sha256", secretKey)
    .update(payload, "utf8")
    .digest("hex");
  
  console.log("Computed Hash:", computedHash);  
