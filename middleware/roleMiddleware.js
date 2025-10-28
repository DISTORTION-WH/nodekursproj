const { secret } = require("../config");
const jwt = require("jsonwebtoken");

module.exports = function(roles) {
  return function(req, res, next) {
    if (req.method === "OPTIONS") {
      return next();
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(403).json({ message: "Пользователь не авторизован" });
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(403).json({ message: "Пользователь не авторизован" });
      }

      const { role: userRole } = jwt.verify(token, secret); // role — строка
      let hasRole = false;

      // Если roles передан как массив, проверяем
      if (Array.isArray(roles)) {
        if (roles.includes(userRole)) {
          hasRole = true;
        }
      } else {
        // Если передан один рол, просто сравниваем
        hasRole = userRole === roles;
      }

      if (!hasRole) {
        return res.status(403).json({ message: "НЕТ ДОСТУПА" });
      }

      next();
    } catch (e) {
      console.log(e);
      return res.status(403).json({ message: "Пользователь не авторизован" });
    }
  };
};
