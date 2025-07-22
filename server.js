const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs");
const input = require("input");

// بيانات الدخول تلقائية للسيرفر
const PHONE_NUMBER = "+966XXXXXXXXX"; // ضع رقمك هنا
const PASSWORD = "YOUR_PASSWORD"; // إذا كان لديك كلمة مرور 2FA
const PHONE_CODE = undefined; // يمكن تركه undefined ليتم تجاهله

const apiId = 23299626;
const apiHash = "89de50a19288ec535e8b008ae2ff268d";

console.log("🚀 البوت يعمل الآن 24 ساعة على السيرفر!");

// نحاول تحميل الجلسة من ملف
let stringSession = new StringSession("");

if (fs.existsSync("session.txt")) {
  const savedSession = fs.readFileSync("session.txt", "utf8");
  stringSession = new StringSession(savedSession.trim());
}

(async () => {
  console.log("📲 بدء الاتصال بتليجرام...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  // تسجيل الدخول عند الحاجة فقط
  await client.start({
    phoneNumber: async () => PHONE_NUMBER,
    password: async () => PASSWORD,
    phoneCode: async () => PHONE_CODE,
    onError: (err) => console.log("❌ خطأ:", err),
  });

  console.log("✅ تم تسجيل الدخول!");
  const sessionString = client.session.save();

  // حفظ الجلسة للاستخدام التالي
  fs.writeFileSync("session.txt", sessionString);
  console.log("💾 تم حفظ الجلسة في session.txt");

  await client.sendMessage("me", { message: "🚀 بوت الإشعارات شغال!" });

  // التتبع والتوجيه
  client.addEventHandler(async (update) => {
    try {
      // استقبال كل الرسائل النصية الحقيقية من أي جهة
      if (update.message && typeof update.message.message === "string") {
        const msg = update.message;
        const text = msg.message;
        // فلترة الرسائل التي تحتوي فقط على "counts: 1" (وليس 11 أو 14)
        if (/counts:\s*1(\D|$)/.test(text)) {
          // استخراج التوكن بعد ca:
          const caMatch = text.match(/ca:\s*([\w]+)/);
          if (caMatch && caMatch[1]) {
            const token = caMatch[1];
            // طباعة التوكن فقط بدون ca:
            console.log(token);
            // حفظ التوكن في ملف لاستخدامه في بوت sniperoo
            fs.writeFileSync('last_token.txt', token, 'utf8');

            // بدء التداول في بوت GMGN
            await tradeInGMGNBot(client, token);
          }
        }
      }
    } catch (err) {
      console.error("❌ خطأ أثناء التوجيه:", err.message);
    }
  });
})();

// دالة التداول التلقائي في بوت GMGN
async function tradeInGMGNBot(client, token) {
  const botUsername = 'GMGN_sol_bot';
  try {
    // بدء المحادثة
    await client.sendMessage(botUsername, { message: '/start' });
    await sleep(2000);
    // إرسال التوكن
    await client.sendMessage(botUsername, { message: token });
    await sleep(3000);

    // استقبال رسائل البوت وطباعة كل رسالة والبحث عن السعر
    let price = null;
    let done = false;
    let lastBotMessage = null;
    const handler = async (update) => {
      // تحقق من أن الرسالة من بوت GMGN بناءً على اسم المستخدم أو peerId
      if (update.message && update.message.peerId && (
            (update.message.peerId.userId && update.message.peerId.userId.toString().includes('GMGN')) ||
            (update.message.peerId.channelId && botUsername.includes('GMGN'))
          )) {
        const text = update.message.message;
        lastBotMessage = text;
        // تحقق أن الرسالة تحتوي على التوكن المطلوب
        if (text.includes(token)) {
          // استخراج السعر من الرسالة
          let priceMatch = text.match(/price:\s*\$?([\d\.]+)/i);
          if (priceMatch && priceMatch[1]) {
            price = parseFloat(priceMatch[1]);
            done = true;
            // طباعة السعر فقط بدون باقي الرسالة وبدون علامة الدولار
            console.log('📩 السعر من GMGN: ' + priceMatch[1]);
            // حساب السعر الجديد بزيادة 1000%
            const newPrice = (price * 10).toFixed(6);
            // إرسال أمر التداول
            const orderMsg = `/create limitbuy ${token} 0.5@${newPrice} -exp 86400`;
            await client.sendMessage(botUsername, { message: orderMsg });
            console.log('✅ تم إرسال أمر التداول:', orderMsg);
          } else {
            // إذا لم يوجد سعر، اطبع الرسالة كاملة
            console.log('📩 رسالة من GMGN:\n' + text);
          }
        }
      }
    };
    client.addEventHandler(handler);
    // انتظر حتى يتم استقبال السعر أو انتهاء المهلة
    let tries = 0;
    while (!done && tries < 10) {
      await sleep(1000);
      tries++;
    }
    client.removeEventHandler(handler);
    if (!price) {
      console.log('📩 رد البوت بعد ارسال التوكن:\n' + (lastBotMessage || 'لم يتم استقبال أي رسالة من البوت بعد إرسال التوكن'));
      return;
    }
    // حساب السعر الجديد بزيادة 1000%
    const newPrice = (price * 10).toFixed(6);
    // إرسال أمر التداول
    const orderMsg = `/create limitbuy ${token} 0.5@${newPrice} -exp 86400`;
    await client.sendMessage(botUsername, { message: orderMsg });
    console.log('✅ تم إرسال أمر التداول:', orderMsg);
  } catch (err) {
    console.error('❌ خطأ في التداول مع GMGN:', err.message);
  }
}

// دالة تأخير بسيطة
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}