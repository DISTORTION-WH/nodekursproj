import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import callAnalyticsService, {
  SaveCallAnalyticsInput,
  ParticipantStatInput,
  InterruptionEventInput,
} from "../Services/callAnalyticsService";

// ─── Request body shapes ─────────────────────────────────────────────────────

interface ParticipantStatBody {
  userId: number;
  talkTimeSeconds: number;
  talkPercent: number;
  interruptionsMade: number;
  interruptionsReceived: number;
  avgAudioLevel: number;
}

interface InterruptionEventBody {
  interrupterUserId: number;
  interruptedUserId: number;
  occurredAt: string; // ISO string from client
}

interface SaveAnalyticsBody {
  startedAt: string; // ISO string
  endedAt: string;   // ISO string
  participantCount: number;
  fairnessIndex: number;
  participants: ParticipantStatBody[];
  interruptions: InterruptionEventBody[];
}

// ─── Validation helpers ──────────────────────────────────────────────────────

function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const d = Date.parse(value);
  return !isNaN(d);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && isFinite(value) && value >= 0;
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// ─── Controller class ─────────────────────────────────────────────────────────

class CallAnalyticsController {
  /**
   * POST /api/call-analytics
   * Body: SaveAnalyticsBody
   * Saves the full analytics for a completed call session.
   * Called by the frontend when the user leaves / call ends.
   */
  async saveAnalytics(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const body = req.body as SaveAnalyticsBody;

      // ── Basic validation ────────────────────────────────────────────────────
      if (!isValidISODate(body.startedAt)) {
        res.status(400).json({ message: "startedAt: обязательное поле, формат ISO 8601" });
        return;
      }
      if (!isValidISODate(body.endedAt)) {
        res.status(400).json({ message: "endedAt: обязательное поле, формат ISO 8601" });
        return;
      }
      if (!isNonNegativeInt(body.participantCount)) {
        res.status(400).json({ message: "participantCount: обязательное целое неотрицательное число" });
        return;
      }
      if (!isPositiveNumber(body.fairnessIndex)) {
        res.status(400).json({ message: "fairnessIndex: обязательное число >= 0" });
        return;
      }
      if (!Array.isArray(body.participants)) {
        res.status(400).json({ message: "participants: обязательный массив" });
        return;
      }
      if (!Array.isArray(body.interruptions)) {
        res.status(400).json({ message: "interruptions: обязательный массив" });
        return;
      }

      // ── Validate each participant entry ─────────────────────────────────────
      for (let i = 0; i < body.participants.length; i++) {
        const p = body.participants[i];
        if (!isNonNegativeInt(p.userId)) {
          res.status(400).json({ message: `participants[${i}].userId: должен быть целым числом` });
          return;
        }
        if (!isPositiveNumber(p.talkTimeSeconds)) {
          res.status(400).json({ message: `participants[${i}].talkTimeSeconds: должен быть >= 0` });
          return;
        }
        if (!isPositiveNumber(p.talkPercent) || p.talkPercent > 1) {
          res.status(400).json({ message: `participants[${i}].talkPercent: должен быть в диапазоне [0, 1]` });
          return;
        }
        if (!isNonNegativeInt(p.interruptionsMade)) {
          res.status(400).json({ message: `participants[${i}].interruptionsMade: должен быть >= 0` });
          return;
        }
        if (!isNonNegativeInt(p.interruptionsReceived)) {
          res.status(400).json({ message: `participants[${i}].interruptionsReceived: должен быть >= 0` });
          return;
        }
        if (!isPositiveNumber(p.avgAudioLevel)) {
          res.status(400).json({ message: `participants[${i}].avgAudioLevel: должен быть >= 0` });
          return;
        }
      }

      // ── Validate each interruption entry ────────────────────────────────────
      for (let i = 0; i < body.interruptions.length; i++) {
        const ev = body.interruptions[i];
        if (!isNonNegativeInt(ev.interrupterUserId)) {
          res.status(400).json({ message: `interruptions[${i}].interrupterUserId: должен быть целым числом` });
          return;
        }
        if (!isNonNegativeInt(ev.interruptedUserId)) {
          res.status(400).json({ message: `interruptions[${i}].interruptedUserId: должен быть целым числом` });
          return;
        }
        if (!isValidISODate(ev.occurredAt)) {
          res.status(400).json({ message: `interruptions[${i}].occurredAt: формат ISO 8601` });
          return;
        }
      }

      // ── Map to service input types ───────────────────────────────────────────
      const participants: ParticipantStatInput[] = body.participants.map((p) => ({
        userId: p.userId,
        talkTimeSeconds: p.talkTimeSeconds,
        talkPercent: p.talkPercent,
        interruptionsMade: p.interruptionsMade,
        interruptionsReceived: p.interruptionsReceived,
        avgAudioLevel: p.avgAudioLevel,
      }));

      const interruptions: InterruptionEventInput[] = body.interruptions.map((ev) => ({
        interrupterUserId: ev.interrupterUserId,
        interruptedUserId: ev.interruptedUserId,
        occurredAt: new Date(ev.occurredAt),
      }));

      const input: SaveCallAnalyticsInput = {
        startedAt: new Date(body.startedAt),
        endedAt: new Date(body.endedAt),
        participantCount: body.participantCount,
        fairnessIndex: body.fairnessIndex,
        participants,
        interruptions,
      };

      const callSessionId = await callAnalyticsService.saveCallAnalytics(input);

      res.status(201).json({ callSessionId });
    } catch (e) {
      next(e);
    }
  }

  /**
   * GET /api/call-analytics/history
   * Returns the call history of the currently authenticated user.
   */
  async getHistory(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const limitRaw = req.query.limit;
      const limit =
        typeof limitRaw === "string" && /^\d+$/.test(limitRaw)
          ? Math.min(parseInt(limitRaw, 10), 200) // cap at 200
          : 50;

      const history = await callAnalyticsService.getCallHistory(userId, limit);
      res.json(history);
    } catch (e) {
      next(e);
    }
  }

  /**
   * GET /api/call-analytics/:callId
   * Returns full details of a single call session.
   * Any authenticated user who participated in the call can access it;
   * admins can access any session.
   */
  async getCallDetail(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { callId } = req.params;

      // Validate UUID format to avoid passing garbage to DB
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(callId)) {
        res.status(400).json({ message: "Неверный формат callId" });
        return;
      }

      const detail = await callAnalyticsService.getCallSessionDetail(callId);

      if (!detail) {
        res.status(404).json({ message: "Сессия звонка не найдена" });
        return;
      }

      // Access check: must be a participant OR an ADMIN
      const userId  = req.user!.id;
      const isAdmin = req.user!.role === "ADMIN";
      const isParticipant = detail.participants.some((p) => p.user_id === userId);

      if (!isAdmin && !isParticipant) {
        res.status(403).json({ message: "Нет доступа к этой сессии" });
        return;
      }

      res.json(detail);
    } catch (e) {
      next(e);
    }
  }

  /**
   * GET /api/call-analytics/team?userIds=1,2,3&from=ISO&to=ISO
   * Aggregated team stats. Restricted to ADMIN and MODERATOR roles.
   */
  async getTeamStats(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userIds: userIdsRaw, from, to } = req.query;

      if (!userIdsRaw || typeof userIdsRaw !== "string") {
        res.status(400).json({ message: "userIds: обязательный параметр (через запятую)" });
        return;
      }

      const userIds = userIdsRaw
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);

      if (userIds.length === 0) {
        res.status(400).json({ message: "userIds: список не содержит валидных ID" });
        return;
      }

      let dateRange: { from: Date; to: Date } | undefined;
      if (from || to) {
        if (!isValidISODate(from) || !isValidISODate(to)) {
          res.status(400).json({ message: "from и to: оба параметра обязательны в формате ISO 8601" });
          return;
        }
        dateRange = { from: new Date(from as string), to: new Date(to as string) };
      }

      const stats = await callAnalyticsService.getTeamStats(userIds, dateRange);
      res.json(stats);
    } catch (e) {
      next(e);
    }
  }
}

export default new CallAnalyticsController();
