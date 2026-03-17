import * as mediasoup from "mediasoup";
import type {
  Worker,
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
} from "mediasoup/node/lib/types";

interface Participant {
  socketId: string;
  userId: number;
  username: string;
  producerTransport?: WebRtcTransport;
  consumerTransport?: WebRtcTransport;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

interface CallRoom {
  chatId: number;
  router: Router;
  participants: Map<number, Participant>;
}

let worker: Worker | null = null;
const rooms = new Map<number, CallRoom>();

const mediaCodecs: any[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {},
  },
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
      "level-asymmetry-allowed": 1,
    },
  },
];

export async function createWorker(): Promise<void> {
  worker = await mediasoup.createWorker({
    rtcMinPort: 10000,
    rtcMaxPort: 10999,
    logLevel: "warn",
  });

  console.log("✅ mediasoup Worker created, pid:", worker.pid);

  worker.on("died", async () => {
    console.error("❌ mediasoup Worker died, restarting...");
    worker = null;
    setTimeout(createWorker, 2000);
  });
}

async function getOrCreateRoom(chatId: number): Promise<CallRoom> {
  let room = rooms.get(chatId);
  if (room) return room;

  if (!worker) throw new Error("mediasoup Worker not initialized");

  const router = await worker.createRouter({ mediaCodecs });
  room = { chatId, router, participants: new Map() };
  rooms.set(chatId, room);
  return room;
}

export async function joinRoom(
  chatId: number,
  userId: number,
  socketId: string,
  username: string
): Promise<void> {
  const room = await getOrCreateRoom(chatId);
  if (!room.participants.has(userId)) {
    room.participants.set(userId, {
      socketId,
      userId,
      username,
      producers: new Map(),
      consumers: new Map(),
    });
  }
}

export function leaveRoom(chatId: number, userId: number): string[] {
  const room = rooms.get(chatId);
  if (!room) return [];

  const participant = room.participants.get(userId);
  if (!participant) return [];

  const producerIds = Array.from(participant.producers.keys());

  // Close all transports/producers/consumers
  participant.producers.forEach((p) => p.close());
  participant.consumers.forEach((c) => c.close());
  participant.producerTransport?.close();
  participant.consumerTransport?.close();

  room.participants.delete(userId);

  // Clean up empty rooms
  if (room.participants.size === 0) {
    room.router.close();
    rooms.delete(chatId);
  }

  return producerIds;
}

export function getRtpCapabilities(chatId: number): object | null {
  const room = rooms.get(chatId);
  return room ? room.router.rtpCapabilities : null;
}

export async function createWebRtcTransport(
  chatId: number,
  userId: number,
  direction: "send" | "recv"
): Promise<{
  transport: WebRtcTransport;
  params: {
    id: string;
    iceParameters: object;
    iceCandidates: object[];
    dtlsParameters: object;
  };
}> {
  const room = rooms.get(chatId);
  if (!room) throw new Error("Room not found");

  const listenIp = process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0";
  const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1";

  const transport = await room.router.createWebRtcTransport({
    listenIps: [{ ip: listenIp, announcedIp }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  const participant = room.participants.get(userId);
  if (participant) {
    if (direction === "send") {
      participant.producerTransport = transport;
    } else {
      participant.consumerTransport = transport;
    }
  }

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
  };
}

export async function connectTransport(
  chatId: number,
  userId: number,
  transportId: string,
  dtlsParameters: any
): Promise<void> {
  const room = rooms.get(chatId);
  if (!room) throw new Error("Room not found");

  const participant = room.participants.get(userId);
  if (!participant) throw new Error("Participant not found");

  let transport: WebRtcTransport | undefined;
  if (participant.producerTransport?.id === transportId) {
    transport = participant.producerTransport;
  } else if (participant.consumerTransport?.id === transportId) {
    transport = participant.consumerTransport;
  }

  if (!transport) throw new Error("Transport not found");
  await transport.connect({ dtlsParameters });
}

export async function produce(
  chatId: number,
  userId: number,
  kind: "audio" | "video",
  rtpParameters: object
): Promise<Producer> {
  const room = rooms.get(chatId);
  if (!room) throw new Error("Room not found");

  const participant = room.participants.get(userId);
  if (!participant?.producerTransport) throw new Error("Producer transport not found");

  const producer = await participant.producerTransport.produce({ kind, rtpParameters } as any);
  participant.producers.set(producer.id, producer);

  producer.on("transportclose", () => {
    participant.producers.delete(producer.id);
  });

  return producer;
}

export async function consume(
  chatId: number,
  consumerUserId: number,
  producerId: string,
  rtpCapabilities: object
): Promise<{
  consumer: Consumer;
  params: {
    id: string;
    producerId: string;
    kind: string;
    rtpParameters: object;
  };
} | null> {
  const room = rooms.get(chatId);
  if (!room) return null;

  if (!room.router.canConsume({ producerId, rtpCapabilities } as any)) {
    return null;
  }

  const participant = room.participants.get(consumerUserId);
  if (!participant?.consumerTransport) return null;

  const consumer = await participant.consumerTransport.consume({
    producerId,
    rtpCapabilities,
    paused: true,
  } as any);

  participant.consumers.set(consumer.id, consumer);

  consumer.on("transportclose", () => {
    participant.consumers.delete(consumer.id);
  });

  return {
    consumer,
    params: {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    },
  };
}

export async function resumeConsumer(
  chatId: number,
  userId: number,
  consumerId: string
): Promise<void> {
  const room = rooms.get(chatId);
  if (!room) return;

  const participant = room.participants.get(userId);
  if (!participant) return;

  const consumer = participant.consumers.get(consumerId);
  if (consumer) await consumer.resume();
}

export function getParticipants(
  chatId: number
): { userId: number; username: string; producerIds: string[] }[] {
  const room = rooms.get(chatId);
  if (!room) return [];

  return Array.from(room.participants.values()).map((p) => ({
    userId: p.userId,
    username: p.username,
    producerIds: Array.from(p.producers.keys()),
  }));
}

export function isRoomActive(chatId: number): boolean {
  return rooms.has(chatId);
}
