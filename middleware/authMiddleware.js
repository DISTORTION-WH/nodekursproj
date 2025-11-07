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
      err.status = 403; 
      return next(err);
    }

    const [type, token] = authHeader.split(" ");
    if (type !== "Bearer" || !token) {
      const err = new Error("Неверный формат токена");
      err.status = 403; 
      return next(err);
    }

    try {
      const decoded = jwt.verify(token, secret);
      req.user = decoded;
      return next(); 
    
    } catch (e) {
      
      if (e.name === "TokenExpiredError") {
        const refreshToken = req.headers["x-refresh-token"];
        
        if (!refreshToken) {
          const err = new Error("Токен истёк, нужен refreshToken");
          err.status = 401; 
          return next(err);
        }

        try {
          const userData = jwt.verify(refreshToken, secret);

          const newAccessToken = jwt.sign(
            { id: userData.id, role: userData.role },
            secret,
            { expiresIn: "15m" }
          );

          res.setHeader("x-access-token", newAccessToken);
          req.user = userData;
          return next();

        } catch (refreshError) {
          console.warn(`[AuthMiddleware] Ошибка Refresh-токена: ${refreshError.message}`);
          const err = new Error("Refresh токен недействителен");
          err.status = 403; 
          return next(err);
        }

      } else {
        console.warn(`[AuthMiddleware] Ошибка Access-токена: ${e.message}`);
        const err = new Error("Пользователь не авторизован (токен невалиден)");
        err.status = 403; 
        return next(err);
      }
    }
  } catch (e) {
    console.error("❗️ Критическая ошибка в authMiddleware:", e.message, e.stack);
    next(e); 
  }
};