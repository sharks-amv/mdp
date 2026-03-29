const { safeSend } = require("./emailClient");

async function sendNoiseAlertEmail({ to, decibel, threshold, createdAt }) {
  const response = await safeSend({
    to,
    subject: `Noise alert: ${decibel.toFixed(1)} dB exceeded ${threshold} dB`,
    type: "noise-alert",
    data: {
      decibel,
      threshold,
      createdAt,
    },
  });

  if (response.ok === false) {
    if (response.error === "unauthorized") {
      console.error("Email API unauthorized: check EMAIL_API_KEY");
      return response;
    }

    if (response.error === "spam_detected") {
      console.warn("Email API blocked message as spam");
      return response;
    }

    if (response.error === "queue_full") {
      console.warn("Email API queue is full, retry later");
      return response;
    }
  }

  return response;
}

module.exports = { sendNoiseAlertEmail };
