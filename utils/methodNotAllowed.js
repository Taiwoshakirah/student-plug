const methodNotAllowed = (req, res) => {
  res.status(400).json({ message: `method ${req.method} not allowed` });
};

module.exports = methodNotAllowed;
