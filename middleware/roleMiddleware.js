const { secret } = require("../config");
const jwt = require("jsonwebtoken");

module.exports = function (roles) {
  return function (req, res, next) {
    if (req.method === "OPTIONS") {
      return next();
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        const err = new Error("Пользователь не авторизован (нет хедера)");
        err.status = 403;
        return next(err);
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        const err = new Error("Пользователь не авторизован (нет токена)");
        err.status = 403;
        return next(err);
      }

      const { role: userRole } = jwt.verify(token, secret);
      let hasRole = false;

      if (Array.isArray(roles)) {
        if (roles.includes(userRole)) {
          hasRole = true;
        }
      } else {
        hasRole = userRole === roles;
      }

      if (!hasRole) {
        const err = new Error("НЕТ ДОСТУПА");
        err.status = 403;
        return next(err);
      }

      next();
    } catch (e) {
      console.error("❗️ Ошибка в roleMiddleware:", e.message);

      const err = new Error("Пользователь не авторизован (ошибка токена)");
      err.status = 403;

      if (e.name === "TokenExpiredError") {
        err.status = 401;
        err.message = "Токен истёк";
      }

      return next(err);
    }
  };
};
