const jwt = require("jsonwebtoken");
const { secret } = require("../config");

module.exports = async function (req, res, next) {
  if (req.method === "OPTIONS") {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      const err = new Error("Нет токена");
      err.status = 403; // Forbidden
      return next(err);
    }

    const [type, token] = authHeader.split(" ");
    if (type !== "Bearer" || !token) {
      const err = new Error("Неверный формат токена");
      err.status = 403; // Forbidden
      return next(err);
    }

    try {
      // 1. Проверка accessToken
      const decoded = jwt.verify(token, secret);
      req.user = decoded;
      return next(); // Все в порядке, токен валиден
    
    } catch (e) {
      // 2. Обработка ошибки accessToken (например, истек срок)
      
      if (e.name === "TokenExpiredError") {
        // 2а. AccessToken истёк, проверяем refreshToken
        const refreshToken = req.headers["x-refresh-token"];
        
        if (!refreshToken) {
          const err = new Error("Токен истёк, нужен refreshToken");
          err.status = 401; // Unauthorized
          return next(err);
        }

        // 2б. Проверяем refreshToken
        try {
          const userData = jwt.verify(refreshToken, secret);

          // Refresh токен валиден, генерируем новый accessToken
          const newAccessToken = jwt.sign(
            { id: userData.id, role: userData.role },
            secret,
            { expiresIn: "15m" }
          );

          // Возвращаем новый токен в заголовках и продолжаем
          res.setHeader("x-access-token", newAccessToken);
          req.user = userData;
          return next();

        } catch (refreshError) {
          // 2в. RefreshToken оказался недействительным (истек или подделан)
          console.warn(`[AuthMiddleware] Ошибка Refresh-токена: ${refreshError.message}`);
          const err = new Error("Refresh токен недействителен");
          err.status = 403; // Forbidden
          return next(err);
        }

      } else {
        // 3. AccessToken невалиден по другой причине (н-р, неверная подпись)
        console.warn(`[AuthMiddleware] Ошибка Access-токена: ${e.message}`);
        const err = new Error("Пользователь не авторизован (токен невалиден)");
        err.status = 403; // Forbidden
        return next(err);
      }
    }
  } catch (e) {
    // 4. Общая ошибка (например, ошибка в коде самого middleware)
    console.error("❗️ Критическая ошибка в authMiddleware:", e.message, e.stack);
    next(e); // Передаем в глобальный обработчик (который вернет 500)
  }
};