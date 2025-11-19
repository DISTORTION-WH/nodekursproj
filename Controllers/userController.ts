import { Request, Response } from 'express';
import userService from "../Services/userService";
import minioService from "../Services/minioService";

interface AuthRequest extends Request {
  user?: {
    id: number;
  };
}

class UserController {
  async updateAvatar(req: Request, res: Response): Promise<any> {
    try {
    
      const authReq = req as AuthRequest;

      if (!req.file) {
        return res.status(400).json({ message: "Файл не загружен" });
      }

      if (!authReq.user) {
        return res.status(401).json({ message: "Пользователь не авторизован" });
      }

      const avatarUrl = await minioService.uploadFile(req.file);
      
      const updatedUser = await userService.updateUserAvatar(
        authReq.user.id,
        avatarUrl
      );

      return res.json({
        message: "Аватар обновлён",
        avatarUrl,
        user: updatedUser,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getProfile(req: Request, res: Response): Promise<any> {
    try {
      const authReq = req as AuthRequest;

      if (!authReq.user) {
        return res.status(401).json({ message: "Пользователь не авторизован" });
      }

      const user = await userService.getUserById(authReq.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }
      
      return res.json(user);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async changePassword(req: Request, res: Response): Promise<any> {
    try {
      const authReq = req as AuthRequest;
      const { oldPassword, newPassword } = req.body;

      if (!authReq.user) {
         return res.status(401).json({ message: "Пользователь не авторизован" });
      }

      if (!oldPassword || !newPassword) {
        return res
          .status(400)
          .json({ message: "oldPassword и newPassword обязательны" });
      }

      await userService.changeUserPassword(
        authReq.user.id,
        oldPassword,
        newPassword
      );

      return res.json({ message: "Пароль изменён" });
    } catch (e: any) {
      console.error(e);
      const msg = e.message || "Ошибка при смене пароля";
      return res.status(400).json({ message: msg });
    }
  }
}

export default new UserController();