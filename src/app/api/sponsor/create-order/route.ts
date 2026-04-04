import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminApp } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

function getItemName(amount: number): string {
  const names: Record<number, string> = {
    50:   '贊助一杯咖啡',
    200:  '贊助一杯酒（蛇目杯）',
    500:  '贊助德利一瓶酒',
    1000: '贊助四合瓶頂級日本酒',
    3000: '贊助菰樽（隱藏級）',
  };
  return names[amount] ?? `贊助 NT$${amount}`;
}

/**
 * ECPay-specific URL encoding (mimics .NET HttpUtility.UrlEncode):
 * - Spaces → '+'
 * - Unreserved ASCII (A-Za-z0-9 - _ .) → unchanged
 * - Everything else → percent-encoded with lowercase hex
 */
function ecpayUrlEncode(str: string): string {
  return str.split('').map(char => {
    if (/[A-Za-z0-9\-_.]/.test(char)) return char;
    if (char === ' ') return '+';
    return encodeURIComponent(char).replace(/%([0-9A-F]{2})/g, (_, h) => `%${h.toLowerCase()}`);
  }).join('');
}

function buildCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIV: string,
): string {
  const sorted = Object.keys(params)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(k => `${k}=${params[k]}`)
    .join('&');
  const raw = `HashKey=${hashKey}&${sorted}&HashIV=${hashIV}`;
  const encoded = ecpayUrlEncode(raw).toLowerCase();
  return crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase();
}

export async function POST(request: NextRequest) {
  // Require authenticated user
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }
  const idToken = authHeader.slice(7);

  let uid: string;
  try {
    const adminAuth = getAuth(getAdminApp());
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: '身份驗證失敗' }, { status: 401 });
  }

  const body = await request.json();
  const amount: number = Number(body.amount);
  if (!Number.isInteger(amount) || amount < 50 || amount > 100000) {
    return NextResponse.json({ error: '金額無效（請輸入 50‑1000 之間的整數）' }, { status: 400 });
  }

  const merchantId = process.env.ECPAY_MERCHANT_ID;
  const hashKey   = process.env.ECPAY_HASH_KEY;
  const hashIV    = process.env.ECPAY_HASH_IV;
  const baseUrl   = process.env.NEXT_PUBLIC_BASE_URL;

  if (!merchantId || !hashKey || !hashIV || !baseUrl) {
    return NextResponse.json({ error: '伺服器設定不完整' }, { status: 500 });
  }

  const isTest = process.env.ECPAY_IS_TEST !== 'false';
  const actionUrl = isTest
    ? 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
    : 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';

  // MerchantTradeNo: max 20 chars, alphanumeric
  const tradeNo = `SAKE${Date.now()}`.slice(0, 20);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const tradeDate = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const params: Record<string, string> = {
    MerchantID:        merchantId,
    MerchantTradeNo:   tradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType:       'aio',
    TotalAmount:       String(amount),
    TradeDesc:         '日本酒品飲筆記App贊助',
    ItemName:          getItemName(amount),
    ReturnURL:         `${baseUrl}/api/sponsor/notify`,
    OrderResultURL:    `${baseUrl}/profile`,
    ChoosePayment:     'ALL',
    EncryptType:       '1',
    CustomField1:      uid,
  };

  params.CheckMacValue = buildCheckMacValue(params, hashKey, hashIV);

  return NextResponse.json({ actionUrl, fields: params });
}
