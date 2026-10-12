import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePaymentMethodFields } from './payment-methods.ts';
function form(values) { const data = new FormData(); for (const [key,value] of Object.entries(values)) data.set(key,value); return data; }
test('crypto requests support multiple assets and require an exact network', () => {
  for (const [asset,network] of [['BTC','Bitcoin'],['ETH','Ethereum'],['SOL','Solana'],['USDT','TRON (TRC20)'],['USDC','Base'],['LINK','Ethereum (ERC20)']]) {
    assert.deepEqual(parsePaymentMethodFields(form({method:'crypto',crypto_asset:asset.toLowerCase(),crypto_network:network,instructions:'Verified address and payment reference'})), {method:'crypto',crypto_asset:asset,crypto_network:network});
  }
});
test('removed methods and incomplete crypto instructions are rejected', () => {
  for (const method of ['stripe_link','manual','wallet_credit','crypto_usdc','unknown']) assert.equal(parsePaymentMethodFields(form({method})),null);
  for (const values of [{crypto_asset:'BTC'}, {crypto_network:'Bitcoin'}, {crypto_asset:'BTC',crypto_network:'Bitcoin'}, {crypto_asset:'<script>',crypto_network:'Bitcoin',instructions:'Details'}]) assert.equal(parsePaymentMethodFields(form({method:'crypto',...values})),null);
});
test('bank payments do not retain submitted crypto metadata', () => {
  assert.deepEqual(parsePaymentMethodFields(form({method:'bank_transfer',crypto_asset:'BTC',crypto_network:'Bitcoin'})),{method:'bank_transfer',crypto_asset:null,crypto_network:null});
});
