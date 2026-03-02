const cron = require("node-cron");
const { syncGMBReviews } = require("../services/gmb.service");

// Run every day at midnight
cron.schedule("0 0 * * *", async () => {
  console.log("Midnight Google Review Sync Running...");
  await syncGMBReviews();
});