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
        // 1. Ошибка: Нет хедера Authorization
        const err = new Error("Пользователь не авторизован (нет хедера)");
        err.status = 403; // Forbidden
        return next(err);
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        // 2. Ошибка: Хедер есть, но токена нет
        const err = new Error("Пользователь не авторизован (нет токена)");
        err.status = 403; // Forbidden
        return next(err);
      }

      // 3. Проверка токена (может выбросить исключение, если токен истек или невалиден)
      // *Примечание: authMiddleware уже должен был проверить это.
      // *Этот middleware - вторая линия защиты.
      const { role: userRole } = jwt.verify(token, secret); 
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
        // 4. Ошибка: Токен валиден, но роль не подходит
        const err = new Error("НЕТ ДОСТУПА");
        err.status = 403; // Forbidden
        return next(err);
      }

      // Все в порядке
      next();
      
    } catch (e) {
      // 5. Ошибка: (e.g., TokenExpiredError, JsonWebTokenError)
      // Сюда мы попадем, если токен истек или невалиден
      console.error("❗️ Ошибка в roleMiddleware:", e.message);
      
      const err = new Error("Пользователь не авторизован (ошибка токена)");
      err.status = 403; // Forbidden (или 401, если токен истек)
      
      if (e.name === 'TokenExpiredError') {
          err.status = 401; // Unauthorized
          err.message = "Токен истёк";
      }
      
      return next(err);
    }
  };
};