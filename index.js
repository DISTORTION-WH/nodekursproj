const express = require("express");
const cors = require("cors");
const authRouter = require("./Routes/authRouter");
const chatRouter = require("./Routes/chatRouter");
const { createRolesTable } = require("./models/Role");
const { createUsersTable } = require("./models/User");
const usersRouter = require("./Routes/usersRouter");
const friendsRouter = require("./Routes/friendsRouter"); 
const chatDeleteRouter = require("./Routes/chatDeleteRouter");
const adminRouter = require("./Routes/adminRouter");

const PORT = process.env.PORT || 5000;

const app = express();
const allowedOrigins = [
  'http://localhost:3000', // Для локальной разработки
  process.env.FRONTEND_URL  // Сюда мы добавим URL (например, https://my-app.vercel.app)
];
app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, Postman) или если origin в списке
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());
app.use("/auth", authRouter);
app.use("/chats", chatRouter);
app.use("/friends", friendsRouter);
app.use("/users", usersRouter);
app.use("/uploads/avatars", express.static("uploads/avatars"));
app.use("/chats", chatDeleteRouter);     // добавляем новые маршруты для удаления
app.use("/admin", adminRouter);

async function start() {
  try {
    // создаём таблицы при старте
    await createRolesTable();
    await createUsersTable();

    app.listen(PORT, () => {
      console.log("🚀 Server started on port " + PORT);
    });
  } catch (e) {
    console.error("Ошибка при запуске:", e);
  }
}

start();
