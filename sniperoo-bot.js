const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// مراقبة ملف التوكن تلقائياً
fs.watchFile(path.resolve(__dirname, 'last_token.txt'), { interval: 1000 }, (curr, prev) => {
  if (curr.mtime !== prev.mtime) {
    console.log('📥 تم تحديث التوكن، بدء التداول تلقائياً...');
    run().catch(console.error);
  }
});

// تحميل التوكن من ملف أو من متغير خارجي
async function getToken() {
  if (fs.existsSync('last_token.txt')) {
    return fs.readFileSync('last_token.txt', 'utf8').trim();
  }
  throw new Error('لا يوجد توكن محفوظ!');
}

async function run() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // تحميل الكوكيز إذا كانت محفوظة
  if (fs.existsSync('cookies.json')) {
    const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
    await page.setCookie(...cookies);
  }

  await page.goto('https://www.sniperoo.app/login', { waitUntil: 'networkidle2' });

  // إذا لم يتم تسجيل الدخول، نفذ تسجيل الدخول عبر Telegram
  if (await page.$('button[aria-label="Continue with Telegram"]')) {
    await page.click('button[aria-label="Continue with Telegram"]');
    // انتظر المستخدم لإكمال تسجيل الدخول يدوياً أول مرة
    console.log('يرجى إكمال تسجيل الدخول عبر Telegram في النافذة المنبثقة.');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    // حفظ الكوكيز بعد تسجيل الدخول
    const cookies = await page.cookies();
    fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));
    console.log('✅ تم حفظ الكوكيز.');
  }

  // انتقل إلى صفحة strategy trading
  await page.goto('https://www.sniperoo.app/dashboard/trade', { waitUntil: 'networkidle2' });

  // جلب التوكن
  const token = await getToken();
  console.log('🔑 التوكن:', token);

  // البحث عن التوكن
  await page.waitForSelector('input[placeholder="Search"]');
  await page.type('input[placeholder="Search"]', token);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  // تنفيذ أمر الشراء (مثال عام، يجب تعديل السليكتورات حسب الموقع الفعلي)
  // ابحث عن زر الشراء
  const buyButton = await page.$('button:has-text("Buy")');
  if (buyButton) {
    await buyButton.click();
    // أدخل سعر الشراء 0.5 SOL
    await page.waitForSelector('input[name="price"]');
    await page.type('input[name="price"]', '0.5');
    // تنفيذ الشراء
    await page.click('button:has-text("Confirm")');
    console.log('✅ تم تنفيذ أمر الشراء!');
  } else {
    console.log('❌ لم يتم العثور على زر الشراء!');
  }

  // يمكنك إضافة منطق مراقبة نسبة الارتفاع هنا
  // ...

  // لا تغلق المتصفح تلقائياً
  // await browser.close();
}

// لا تشغل run() مباشرة، سيتم تشغيلها تلقائياً عند تحديث التوكن
// run().catch(console.error);
