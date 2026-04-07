// middleware/superadmin.js
const auth = require('./auth');

function superAdminMiddleware(req, res, next) {
  if (req.user && req.user.role === 'superadmin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Super Admin role required.' });
  }
}

module.exports = [auth, superAdminMiddleware];
