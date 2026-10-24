import test from 'node:test';
import assert from 'node:assert/strict';
import { bankDetails, proofImage, tokenMatches } from '../lib/bank-payment.mjs';

test('bank account details require safe server-side configuration',()=>{
  assert.equal(bankDetails({}),null);
  assert.equal(bankDetails({BANK_NAME:'<script>alert(1)</script>',BANK_ACCOUNT_NAME:'Owner',BANK_ACCOUNT_NUMBER:'1234567890'}),null);
  assert.equal(bankDetails({BANK_NAME:'Example Bank',BANK_ACCOUNT_NAME:'Owner',BANK_ACCOUNT_NUMBER:'123456789'}),null);
  assert.deepEqual(bankDetails({BANK_NAME:'Example Bank',BANK_ACCOUNT_NAME:'DrealSkinhub',BANK_ACCOUNT_NUMBER:'1234567890'}),{bank:'Example Bank',name:'DrealSkinhub',number:'1234567890'});
});

test('proof files accept only bounded image bytes, never script or document types',()=>{
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlZ5XcAAAAASUVORK5CYII=';
  assert.equal(proofImage(png,'image/png').ext,'png');
  assert.throws(()=>proofImage(Buffer.from('<svg onload="alert(1)"></svg>').toString('base64'),'image/svg+xml'));
  assert.throws(()=>proofImage(Buffer.from('<script>alert(1)</script>').toString('base64'),'image/png'));
  assert.throws(()=>proofImage(png+'<script>','image/png'));
  assert.equal(tokenMatches('bad','0'.repeat(64)),false);
});
