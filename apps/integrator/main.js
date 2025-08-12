const logger = require("@pkg/logger").getLogger("main");

const {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand
} = require("@aws-sdk/client-sqs");

const {
  scraper_mf,
  scraper_key_mf,
 } = require("@app/scraper-mf");

// --- 設定（環境変数で上書き可能） ---
const REGION = process.env.SCRAPER_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const QUEUE_URL = process.env.SCRAPER_READ_QUEUE; // 必須: SQSのURL
const WAIT_SECONDS = Number(process.env.WAIT_SECONDS || 20); // 長ポーリング
const VISIBILITY_SECONDS = Number(process.env.VISIBILITY_SECONDS || 60); // 初期不可視
const HEARTBEAT_SECONDS = Number(process.env.HEARTBEAT_SECONDS || 30);   // 不可視延長の間隔
const IDLE_SHUTDOWN_SECONDS = Number(process.env.IDLE_SHUTDOWN_SECONDS || 300); // 自動終了するアイドル時間

if (!QUEUE_URL) {
  console.error("SCRAPER_READ_QUEUE が未設定です。環境変数で指定してください。");
  logger.fatal("SCRAPER_READ_QUEUE が未設定です。環境変数で指定してください。");
  process.exit(1);
}

const sqs = new SQSClient({ region: REGION });

// 擬似ジョブ（ここで Puppeteer を呼び出す想定）
async function runPuppeteerJob(payload) {
  // 例:
  // const puppeteer = require('puppeteer');
  // const browser = await puppeteer.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
  // const page = await browser.newPage();
  // await page.goto(payload.url, { waitUntil: "networkidle0" });
  // ... 作業 ...
  // await browser.close();

  // デモ: 代わりに待つだけ
  logger.trace(payload);
  const scraper_key = payload.key;
  if (! scraper_key) {
    throw new Error("key not found")
  }
  logger.info(`[JOB] start: ${scraper_key}`);
  try {
    if (scraper_key == scraper_key_mf) {
      scraper_mf()
    }
    else {
      throw new Error(`unknown scraper: ${scraper_key}`)
    }
    logger.info(`[JOB] done: ${scraper_key}`);
  } catch (e) {
    logger.error("[JOB] error:", e);
  }
}

let lastMessageAt = Date.now();
let stopping = false;

function shouldShutdownForIdle() {
  return (Date.now() - lastMessageAt) / 1000 >= IDLE_SHUTDOWN_SECONDS;
}

async function extendVisibility(ReceiptHandle) {
  try {
    await sqs.send(new ChangeMessageVisibilityCommand({
      QueueUrl: QUEUE_URL,
      ReceiptHandle,
      VisibilityTimeout: VISIBILITY_SECONDS
    }));
    logger.info(`[SQS] Visibility extended for ${ReceiptHandle.slice(-8)}`);
  } catch (e) {
    logger.error("[SQS] ChangeMessageVisibility error:", e);
  }
}

async function receiveOne() {
  const res = await sqs.send(new ReceiveMessageCommand({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: WAIT_SECONDS,
    VisibilityTimeout: VISIBILITY_SECONDS // 初期可視性
  }));
  return res.Messages?.[0];
}

async function mainLoop() {
  logger.log(`[INIT] region=${REGION}, queue=${QUEUE_URL}`);
  while (!stopping) {
    logger.debug("wait for msg");
    const msg = await receiveOne();
    logger.debug("msg found or timeout");
    if (!msg) {
      logger.debug("no msg");
      if (shouldShutdownForIdle()) {
        logger.info(`[EXIT] idle ${IDLE_SHUTDOWN_SECONDS}s reached. Bye.`);
        break;
      }
      continue;
    }

    lastMessageAt = Date.now();
    const receipt = msg.ReceiptHandle;
    let hbTimer = null;

    logger.trace(msg.Body);
    try {
      const body = JSON.parse(msg.Body);
      // 長時間ジョブに備え、定期的に可視性を延長
      hbTimer = setInterval(() => extendVisibility(receipt), HEARTBEAT_SECONDS * 1000);

      await runPuppeteerJob(body);

      await sqs.send(new DeleteMessageCommand({ QueueUrl: QUEUE_URL, ReceiptHandle: receipt }));
      logger.info(`[SQS] deleted msg ${msg.MessageId}`);
    } catch (e) {
      logger.error("[JOB] error:", e);
      // 削除しない → 可視性タイムアウト後に再配信（DLQ）
    } finally {
      if (hbTimer) clearInterval(hbTimer);
    }
  }
  // ここに到達したらプロセス終了
  if (require.main === module) {
    logger.info("process exit.");
    process.exit(0);
  }
}

if (require.main === module) {
  process.on("SIGINT", () => { logger.warn("SIGINT"); stopping = true; });
  process.on("SIGTERM", () => { logger.warn("SIGTERM"); stopping = true; });

  mainLoop().catch(err => {
    logger.fatal("[FATAL]", err);
    process.exit(1);
  });
}
