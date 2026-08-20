const { redisPub, redisSub } = require("../config/redis");

const CHANNELS = {
  PROJECT_MESSAGE: "squadforge:project:message",
};

/**
 * Redis Pub/Sub:
 * Publisher sends an event; all subscribed server instances receive it.
 * Useful when you run multiple Node processes (horizontal scale).
 * Socket.io Redis adapter also uses pub/sub under the hood for rooms.
 */

async function publishProjectMessage(projectId, message) {
  await redisPub.publish(
    CHANNELS.PROJECT_MESSAGE,
    JSON.stringify({ projectId, message })
  );
}

function subscribeProjectMessages(handler) {
  redisSub.subscribe(CHANNELS.PROJECT_MESSAGE, (err) => {
    if (err) console.log("PubSub subscribe error:", err.message);
    else console.log("Subscribed to project message channel");
  });

  redisSub.on("message", (channel, raw) => {
    if (channel !== CHANNELS.PROJECT_MESSAGE) return;
    try {
      const data = JSON.parse(raw);
      handler(data);
    } catch (err) {
      console.log("PubSub message parse error:", err.message);
    }
  });
}

module.exports = {
  CHANNELS,
  publishProjectMessage,
  subscribeProjectMessages,
};
