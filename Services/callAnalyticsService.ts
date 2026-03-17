import client from "../databasepg";
import { QueryResult } from "pg";

// ─── Domain interfaces ────────────────────────────────────────────────────────

export interface ParticipantStatInput {
  userId: number;
  talkTimeSeconds: number;
  talkPercent: number;
  interruptionsMade: number;
  interruptionsReceived: number;
  avgAudioLevel: number;
}

export interface InterruptionEventInput {
  interrupterUserId: number;
  interruptedUserId: number;
  occurredAt: Date;
}

export interface SaveCallAnalyticsInput {
  startedAt: Date;
  endedAt: Date;
  participantCount: number;
  fairnessIndex: number;
  participants: ParticipantStatInput[];
  interruptions: InterruptionEventInput[];
}

// ─── Row shapes returned from DB ─────────────────────────────────────────────

export interface CallSessionRow {
  id: string;
  started_at: Date;
  ended_at: Date;
  participant_count: number;
  fairness_index: number;
}

export interface ParticipantStatRow {
  id: string;
  call_session_id: string;
  user_id: number;
  username: string;
  avatar_url: string | null;
  talk_time_seconds: number;
  talk_percent: number;
  interruptions_made: number;
  interruptions_received: number;
  avg_audio_level: number;
}

export interface InterruptionEventRow {
  id: string;
  call_session_id: string;
  interrupter_user_id: number;
  interrupter_username: string;
  interrupted_user_id: number;
  interrupted_username: string;
  occurred_at: Date;
}

export interface CallSessionDetail extends CallSessionRow {
  participants: ParticipantStatRow[];
  interruptions: InterruptionEventRow[];
}

export interface CallHistoryItem {
  id: string;
  started_at: Date;
  ended_at: Date;
  participant_count: number;
  fairness_index: number;
  /** This user's stats within the session */
  my_talk_time_seconds: number;
  my_talk_percent: number;
  my_interruptions_made: number;
  my_interruptions_received: number;
}

export interface TeamStatsRow {
  user_id: number;
  username: string;
  avatar_url: string | null;
  total_call_sessions: number;
  total_talk_time_seconds: number;
  avg_talk_percent: number;
  total_interruptions_made: number;
  total_interruptions_received: number;
  avg_audio_level: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

// ─── Service class ────────────────────────────────────────────────────────────

class CallAnalyticsService {
  /**
   * Persist a complete call session with all participant stats and interruption
   * events in a single DB transaction.
   * Returns the newly created call_session id (UUID).
   */
  async saveCallAnalytics(data: SaveCallAnalyticsInput): Promise<string> {
    await client.query("BEGIN");

    try {
      // 1. Insert call_sessions row
      const sessionRes: QueryResult<{ id: string }> = await client.query(
        `INSERT INTO call_sessions
           (started_at, ended_at, participant_count, fairness_index)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [data.startedAt, data.endedAt, data.participantCount, data.fairnessIndex]
      );
      const callSessionId = sessionRes.rows[0].id;

      // 2. Insert participant_stats rows (batch via unnest for efficiency)
      if (data.participants.length > 0) {
        // Build parallel arrays for unnest
        const userIds: number[]         = [];
        const talkTimes: number[]       = [];
        const talkPercents: number[]    = [];
        const intMades: number[]        = [];
        const intReceived: number[]     = [];
        const avgLevels: number[]       = [];

        for (const p of data.participants) {
          userIds.push(p.userId);
          talkTimes.push(p.talkTimeSeconds);
          talkPercents.push(p.talkPercent);
          intMades.push(p.interruptionsMade);
          intReceived.push(p.interruptionsReceived);
          avgLevels.push(p.avgAudioLevel);
        }

        await client.query(
          `INSERT INTO participant_stats
             (call_session_id, user_id, talk_time_seconds, talk_percent,
              interruptions_made, interruptions_received, avg_audio_level)
           SELECT $1,
                  unnest($2::int[]),
                  unnest($3::float[]),
                  unnest($4::float[]),
                  unnest($5::int[]),
                  unnest($6::int[]),
                  unnest($7::float[])`,
          [callSessionId, userIds, talkTimes, talkPercents, intMades, intReceived, avgLevels]
        );
      }

      // 3. Insert interruption_events rows
      if (data.interruptions.length > 0) {
        const interrupterIds: number[] = [];
        const interruptedIds: number[] = [];
        const occurredAts: Date[]      = [];

        for (const ev of data.interruptions) {
          interrupterIds.push(ev.interrupterUserId);
          interruptedIds.push(ev.interruptedUserId);
          occurredAts.push(ev.occurredAt);
        }

        await client.query(
          `INSERT INTO interruption_events
             (call_session_id, interrupter_user_id, interrupted_user_id, occurred_at)
           SELECT $1,
                  unnest($2::int[]),
                  unnest($3::int[]),
                  unnest($4::timestamptz[])`,
          [callSessionId, interrupterIds, interruptedIds, occurredAts]
        );
      }

      await client.query("COMMIT");
      return callSessionId;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }

  /**
   * Returns the call history for a given user, newest first.
   * Each row includes the user's own stats for that session.
   */
  async getCallHistory(userId: number, limit = 50): Promise<CallHistoryItem[]> {
    const res: QueryResult<CallHistoryItem> = await client.query(
      `SELECT
         cs.id,
         cs.started_at,
         cs.ended_at,
         cs.participant_count,
         cs.fairness_index,
         ps.talk_time_seconds     AS my_talk_time_seconds,
         ps.talk_percent          AS my_talk_percent,
         ps.interruptions_made    AS my_interruptions_made,
         ps.interruptions_received AS my_interruptions_received
       FROM call_sessions cs
       JOIN participant_stats ps
         ON ps.call_session_id = cs.id
        AND ps.user_id = $1
       ORDER BY cs.started_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return res.rows;
  }

  /**
   * Returns full detail for a single call session including all participants
   * and all interruption events.
   * Returns null when the session doesn't exist.
   */
  async getCallSessionDetail(callId: string): Promise<CallSessionDetail | null> {
    const sessionRes: QueryResult<CallSessionRow> = await client.query(
      `SELECT id, started_at, ended_at, participant_count, fairness_index
       FROM call_sessions
       WHERE id = $1`,
      [callId]
    );

    if (sessionRes.rows.length === 0) return null;

    const session = sessionRes.rows[0];

    const participantsRes: QueryResult<ParticipantStatRow> = await client.query(
      `SELECT
         ps.id,
         ps.call_session_id,
         ps.user_id,
         u.username,
         u.avatar_url,
         ps.talk_time_seconds,
         ps.talk_percent,
         ps.interruptions_made,
         ps.interruptions_received,
         ps.avg_audio_level
       FROM participant_stats ps
       JOIN users u ON u.id = ps.user_id
       WHERE ps.call_session_id = $1
       ORDER BY ps.talk_time_seconds DESC`,
      [callId]
    );

    const interruptionsRes: QueryResult<InterruptionEventRow> = await client.query(
      `SELECT
         ie.id,
         ie.call_session_id,
         ie.interrupter_user_id,
         ui.username  AS interrupter_username,
         ie.interrupted_user_id,
         ud.username  AS interrupted_username,
         ie.occurred_at
       FROM interruption_events ie
       JOIN users ui ON ui.id = ie.interrupter_user_id
       JOIN users ud ON ud.id = ie.interrupted_user_id
       WHERE ie.call_session_id = $1
       ORDER BY ie.occurred_at ASC`,
      [callId]
    );

    return {
      ...session,
      participants: participantsRes.rows,
      interruptions: interruptionsRes.rows,
    };
  }

  /**
   * Aggregated statistics across all sessions for a set of users within an
   * optional date range.  Used for team/admin dashboards.
   */
  async getTeamStats(userIds: number[], dateRange?: DateRange): Promise<TeamStatsRow[]> {
    // Build optional date filter clause
    const conditions: string[] = ["ps.user_id = ANY($1)"];
    const params: (number[] | Date)[] = [userIds];
    let paramIdx = 2;

    if (dateRange) {
      conditions.push(`cs.started_at >= $${paramIdx}`);
      params.push(dateRange.from);
      paramIdx++;

      conditions.push(`cs.started_at <= $${paramIdx}`);
      params.push(dateRange.to);
    }

    const whereClause = conditions.length > 0
      ? "WHERE " + conditions.join(" AND ")
      : "";

    const res: QueryResult<TeamStatsRow> = await client.query(
      `SELECT
         ps.user_id,
         u.username,
         u.avatar_url,
         COUNT(DISTINCT ps.call_session_id)::int   AS total_call_sessions,
         SUM(ps.talk_time_seconds)::float           AS total_talk_time_seconds,
         AVG(ps.talk_percent)::float                AS avg_talk_percent,
         SUM(ps.interruptions_made)::int            AS total_interruptions_made,
         SUM(ps.interruptions_received)::int        AS total_interruptions_received,
         AVG(ps.avg_audio_level)::float             AS avg_audio_level
       FROM participant_stats ps
       JOIN users u ON u.id = ps.user_id
       JOIN call_sessions cs ON cs.id = ps.call_session_id
       ${whereClause}
       GROUP BY ps.user_id, u.username, u.avatar_url
       ORDER BY total_talk_time_seconds DESC`,
      params
    );

    return res.rows;
  }
}

export default new CallAnalyticsService();
