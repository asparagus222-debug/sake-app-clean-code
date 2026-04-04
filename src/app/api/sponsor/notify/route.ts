import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getAdminApp } from '@/lib/firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * ECPay-specific URL encoding (mimics .NET HttpUtility.UrlEncode).
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

/**
 * ECPay payment result notification endpoint (ReturnURL / NotifyURL).
 * ECPay sends a form-encoded POST after each completed payment.
 * Must respond with '1|OK' on success.
 */
export async function POST(request: NextRequest) {
  const hashKey = process.env.ECPAY_HASH_KEY;
  const hashIV  = process.env.ECPAY_HASH_IV;

  if (!hashKey || !hashIV) {
    return new Response('0|ServerError', { status: 200 });
  }

  // Parse form-encoded body from ECPay
  const text = await request.text();
  const body = Object.fromEntries(new URLSearchParams(text));

  // Verify HMAC-SHA256 signature to reject forged notifications
  const { CheckMacValue, ...paramsWithoutCheck } = body;
  const expected = buildCheckMacValue(paramsWithoutCheck, hashKey, hashIV);
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(CheckMacValue ?? ''))) {
    return new Response('0|SignatureError', { status: 200 });
  }

  // Payment must be successful (RtnCode '1' = success)
  if (body.RtnCode !== '1') {
    return new Response('1|OK', { status: 200 });
  }

  const uid     = body.CustomField1;
  const amount  = parseInt(body.TradeAmt, 10);
  const tradeNo = body.MerchantTradeNo;

  if (!uid || isNaN(amount) || amount <= 0 || !tradeNo) {
    return new Response('0|InvalidData', { status: 200 });
  }

  const db = getFirestore(getAdminApp());

  // Idempotency: each MerchantTradeNo is processed exactly once
  const paymentRef = db.collection('sponsorPayments').doc(tradeNo);

  await db.runTransaction(async tx => {
    const existing = await tx.get(paymentRef);
    if (existing.exists) return; // already processed, skip

    tx.set(paymentRef, {
      uid,
      amount,
      createdAt: new Date().toISOString(),
    });
    tx.update(db.collection('users').doc(uid), {
      sponsorTotal: FieldValue.increment(amount),
    });
  });

  return new Response('1|OK', { status: 200 });
}
