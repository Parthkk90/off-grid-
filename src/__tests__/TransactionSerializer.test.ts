import {ethers} from 'ethers';
import TransactionSerializer from '../services/transaction/TransactionSerializer';
import {TransferIntent} from '../types/transaction';
import {TransactionSerializationError} from '../utils/errors';
import {DEFAULT_TTL} from '../utils/constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal but valid signed TransferIntent using an ephemeral wallet */
async function makeSignedIntent(
  wallet: ethers.Wallet,
  overrides: Partial<TransferIntent> = {},
): Promise<TransferIntent> {
  const base: Omit<TransferIntent, 'signature'> = {
    id: 'test-tx-001',
    from: wallet.address,
    to: '0xRecipientAddress000000000000000000000001',
    amount: '25.50',
    tokenAddress: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B',
    tokenSymbol: 'USDC',
    nonce: 1,
    vectorClock: {[wallet.address]: 1},
    timestamp: 1741651200000,
    ttl: DEFAULT_TTL,
    ...overrides,
  };

  const intentPayload = JSON.stringify({
    from: base.from,
    to: base.to,
    amount: base.amount,
    tokenAddress: base.tokenAddress,
    tokenSymbol: base.tokenSymbol,
    nonce: base.nonce,
    vectorClock: base.vectorClock,
    timestamp: base.timestamp,
  });

  const signature = await wallet.signMessage(intentPayload);
  return {...base, signature} as TransferIntent;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TransactionSerializer', () => {
  let wallet: ethers.Wallet;
  let intent: TransferIntent;

  beforeAll(async () => {
    wallet = ethers.Wallet.createRandom();
    intent = await makeSignedIntent(wallet);
  });

  // ─── serialize ──────────────────────────────────────────────────

  it('serialize returns a JSON string', () => {
    const serialized = TransactionSerializer.serialize(intent);
    expect(typeof serialized).toBe('string');
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  it('serialized JSON contains all required fields', () => {
    const parsed = JSON.parse(TransactionSerializer.serialize(intent));
    const required = [
      'id',
      'from',
      'to',
      'amount',
      'tokenAddress',
      'tokenSymbol',
      'nonce',
      'vectorClock',
      'signature',
      'timestamp',
      'ttl',
    ];
    for (const field of required) {
      expect(parsed).toHaveProperty(field);
    }
  });

  it('serialized values match original intent', () => {
    const parsed = JSON.parse(TransactionSerializer.serialize(intent));
    expect(parsed.id).toBe(intent.id);
    expect(parsed.from).toBe(intent.from);
    expect(parsed.to).toBe(intent.to);
    expect(parsed.amount).toBe(intent.amount);
    expect(parsed.nonce).toBe(intent.nonce);
    expect(parsed.signature).toBe(intent.signature);
  });

  // ─── deserialize ────────────────────────────────────────────────

  it('deserialize round-trips back to the original intent', () => {
    const serialized = TransactionSerializer.serialize(intent);
    const recovered = TransactionSerializer.deserialize(serialized);
    expect(recovered.id).toBe(intent.id);
    expect(recovered.from).toBe(intent.from);
    expect(recovered.to).toBe(intent.to);
    expect(recovered.amount).toBe(intent.amount);
    expect(recovered.nonce).toBe(intent.nonce);
    expect(recovered.signature).toBe(intent.signature);
    expect(recovered.vectorClock).toEqual(intent.vectorClock);
  });

  it('deserialize throws on missing required field', () => {
    const bad = JSON.stringify({id: 'x', from: '0xABC'}); // missing many fields
    expect(() => TransactionSerializer.deserialize(bad)).toThrow(
      TransactionSerializationError,
    );
  });

  it('deserialize throws on wrong type for id field', () => {
    const serialized = TransactionSerializer.serialize(intent);
    const parsed = JSON.parse(serialized);
    parsed.id = 12345; // should be string
    expect(() =>
      TransactionSerializer.deserialize(JSON.stringify(parsed)),
    ).toThrow(TransactionSerializationError);
  });

  it('deserialize throws on wrong type for nonce field', () => {
    const serialized = TransactionSerializer.serialize(intent);
    const parsed = JSON.parse(serialized);
    parsed.nonce = 'not-a-number';
    expect(() =>
      TransactionSerializer.deserialize(JSON.stringify(parsed)),
    ).toThrow(TransactionSerializationError);
  });

  it('deserialize throws on invalid JSON', () => {
    expect(() =>
      TransactionSerializer.deserialize('definitely not json {{{'),
    ).toThrow(TransactionSerializationError);
  });

  // ─── validateSignature ──────────────────────────────────────────

  it('validateSignature returns true for a correctly signed intent', () => {
    expect(TransactionSerializer.validateSignature(intent)).toBe(true);
  });

  it('validateSignature returns false when signature is wrong', () => {
    const tampered: TransferIntent = {
      ...intent,
      signature: '0x' + 'ff'.repeat(65), // invalid signature bytes
    };
    expect(TransactionSerializer.validateSignature(tampered)).toBe(false);
  });

  it('validateSignature returns false when amount is tampered', () => {
    const tampered: TransferIntent = {
      ...intent,
      amount: '99999.99', // changed after signing
    };
    // Signature no longer matches the payload
    expect(TransactionSerializer.validateSignature(tampered)).toBe(false);
  });

  it('validateSignature returns false when from address is wrong', () => {
    const otherWallet = ethers.Wallet.createRandom();
    const tampered: TransferIntent = {
      ...intent,
      from: otherWallet.address, // different address than who signed
    };
    expect(TransactionSerializer.validateSignature(tampered)).toBe(false);
  });

  it('validateSignature returns false for empty signature', () => {
    const tampered: TransferIntent = {...intent, signature: ''};
    expect(TransactionSerializer.validateSignature(tampered)).toBe(false);
  });

  // ─── Full flow: serialize → deserialize → validate ──────────────

  it('full end-to-end: serialize, transmit, deserialize, validate signature', async () => {
    const senderWallet = ethers.Wallet.createRandom();
    const original = await makeSignedIntent(senderWallet, {
      id: 'e2e-test',
      amount: '10.00',
    });

    // Simulate BLE transmission
    const wire = TransactionSerializer.serialize(original);

    // Receiver side
    const received = TransactionSerializer.deserialize(wire);
    expect(TransactionSerializer.validateSignature(received)).toBe(true);
    expect(received.amount).toBe('10.00');
  });

  it('multicurrency: works for cUSD token as well', async () => {
    const cusdWallet = ethers.Wallet.createRandom();
    const cusdIntent = await makeSignedIntent(cusdWallet, {
      tokenAddress: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',
      tokenSymbol: 'cUSD',
      amount: '5.00',
    });
    const wire = TransactionSerializer.serialize(cusdIntent);
    const received = TransactionSerializer.deserialize(wire);
    expect(received.tokenSymbol).toBe('cUSD');
    expect(TransactionSerializer.validateSignature(received)).toBe(true);
  });
});
