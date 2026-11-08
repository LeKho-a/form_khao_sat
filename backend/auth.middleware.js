const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Chưa cung cấp mã xác thực (token)!' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Mã xác thực không hợp lệ hoặc đã hết hạn!' });
        }
        req.user = user;
        next();
    });
};

module.exports = authenticateToken;