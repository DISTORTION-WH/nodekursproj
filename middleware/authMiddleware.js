const jwt = require("jsonwebtoken");
const { secret } = require("../config");

module.exports = async function (req, res, next) {
  if (req.method === "OPTIONS") return next();

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(403).json({ message: "Нет токена" });

    const [type, token] = authHeader.split(" ");
    if (type !== "Bearer" || !token) return res.status(403).json({ message: "Неверный формат токена" });

    try {
      // Проверка accessToken
      const decoded = jwt.verify(token, secret);
      req.user = decoded;
      return next();
    } catch (e) {
      // Если токен истёк
      if (e.name === "TokenExpiredError") {
        const refreshToken = req.headers["x-refresh-token"];
        if (!refreshToken) return res.status(401).json({ message: "Токен истёк, нужен refreshToken" });

        // Проверяем refreshToken
        jwt.verify(refreshToken, secret, (err, userData) => {
          if (err) return res.status(403).json({ message: "Refresh токен недействителен" });

          // Генерация нового accessToken
          const newAccessToken = jwt.sign(
            { id: userData.id, role: userData.role },
            secret,
            { expiresIn: "15m" }
          );

          // Возвращаем новый токен в заголовках и продолжаем
          res.setHeader("x-access-token", newAccessToken);
          req.user = userData;
          next();
        });
      } else {
        return res.status(403).json({ message: "Пользователь не авторизован" });
      }
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Ошибка сервера в authMiddleware" });
  }
};
