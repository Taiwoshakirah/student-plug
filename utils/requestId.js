// Function to generate a requestId
function generateRequestId() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; 
    const minLength = 12; 
    const maxLength = 16; 
  
    // Generate a random length between 12 and 16
    const requestIdLength = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
  
    let requestId = '';
    for (let i = 0; i < requestIdLength; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      requestId += characters[randomIndex];
    }
  
    return requestId;
  }
  
  
  module.exports = generateRequestId;
  